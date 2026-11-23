using Exchange.Application.Common;
using Exchange.Application.DTOs.Orders;
using Exchange.Application.Interfaces;
using Exchange.Domain.Entities;
using Exchange.Domain.Enums;
using Exchange.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Exchange.Infrastructure.Services;

public class FuturesService : IFuturesService
{
    private readonly AppDbContext _db;
    private readonly IPriceCache _priceCache;
    private readonly INotificationService _notifications;
    private const decimal MMR = 0.005m;

    public FuturesService(AppDbContext db, IPriceCache priceCache, INotificationService notifications)
    {
        _db = db;
        _priceCache = priceCache;
        _notifications = notifications;
    }

    public async Task<Result<FuturesPositionDto>> OpenPositionAsync(Guid userId, PlaceOrderRequest req, CancellationToken ct = default)
    {
        if (req.Direction == null) return Result<FuturesPositionDto>.Failure("Direction required for futures");
        if (req.Leverage == null || req.Leverage < 1 || req.Leverage > 50) return Result<FuturesPositionDto>.Failure("Invalid leverage (1-50)");

        var pair = await _db.TradingPairs
            .Include(p => p.BaseAsset).Include(p => p.QuoteAsset)
            .FirstOrDefaultAsync(p => p.Symbol == req.Symbol && p.IsFuturesActive, ct);
        if (pair == null) return Result<FuturesPositionDto>.Failure("Pair not found or futures disabled");

        var currentPrice = _priceCache.GetPrice(req.Symbol)
            ?? throw new InvalidOperationException($"No price for {req.Symbol}");
        var fillPrice = req.OrderType == OrderType.Market ? currentPrice : req.Price!.Value;

        var notional = fillPrice * req.Quantity;
        var initialMargin = notional / req.Leverage.Value;
        var maintenanceMargin = notional * MMR;
        var fee = notional * pair.FuturesTakerFee;
        var totalRequired = initialMargin + fee;

        await using var tx = await _db.Database.BeginTransactionAsync(ct);
        try
        {
            var usdtAsset = await _db.Assets.FirstAsync(a => a.Symbol == "USDT", ct);
            var wallet = await _db.Wallets.FirstOrDefaultAsync(
                w => w.UserId == userId && w.WalletType == WalletType.Futures && w.AssetId == usdtAsset.Id, ct);
            if (wallet == null || wallet.AvailableBalance < totalRequired)
                return Result<FuturesPositionDto>.Failure($"Insufficient futures balance. Need {totalRequired:F4} USDT");

            wallet.AvailableBalance -= totalRequired;
            wallet.UpdatedAt = DateTime.UtcNow;

            // Liquidation price
            var liqPrice = CalculateLiquidationPrice(fillPrice, req.Leverage.Value, req.Direction.Value);

            var position = new FuturesPosition
            {
                UserId = userId,
                TradingPairId = pair.Id,
                Direction = req.Direction.Value,
                Leverage = req.Leverage.Value,
                EntryPrice = fillPrice,
                Quantity = req.Quantity,
                InitialMargin = initialMargin,
                MaintenanceMargin = maintenanceMargin,
                LiquidationPrice = liqPrice,
                TakeProfit = req.TakeProfit,
                StopLoss = req.StopLoss,
                Commission = fee,
                TradingPair = pair
            };
            _db.FuturesPositions.Add(position);

            // Record order
            var order = new Order
            {
                UserId = userId, TradingPairId = pair.Id,
                OrderType = req.OrderType, MarketType = MarketType.Futures,
                Side = req.Direction == Direction.Long ? OrderSide.Buy : OrderSide.Sell,
                Direction = req.Direction, Leverage = req.Leverage,
                Price = req.OrderType == OrderType.Market ? null : req.Price,
                Quantity = req.Quantity,
                Status = OrderStatus.Filled, FilledQuantity = req.Quantity,
                AvgFillPrice = fillPrice, Commission = fee, FilledAt = DateTime.UtcNow
            };
            _db.Orders.Add(order);

            await _db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);

            var dto = MapPosition(position, _priceCache.GetPrice(pair.Symbol) ?? fillPrice);
            return Result<FuturesPositionDto>.Success(dto, 201);
        }
        catch { await tx.RollbackAsync(ct); throw; }
    }

    public async Task<Result> ClosePositionAsync(Guid userId, ClosePositionRequest req, CancellationToken ct = default)
    {
        await using var tx = await _db.Database.BeginTransactionAsync(ct);
        try
        {
            var pos = await _db.FuturesPositions
                .Include(p => p.TradingPair)
                .FirstOrDefaultAsync(p => p.Id == req.PositionId && p.UserId == userId, ct);
            if (pos == null) return Result.Failure("Position not found", 404);
            if (pos.Status != PositionStatus.Open) return Result.Failure("Position already closed");

            var closePrice = _priceCache.GetPrice(pos.TradingPair.Symbol)
                ?? throw new InvalidOperationException("No price data");

            var closeQty = req.Quantity ?? pos.Quantity;
            var isPartial = closeQty < pos.Quantity;

            var pnl = pos.Direction == Direction.Long
                ? (closePrice - pos.EntryPrice) * closeQty
                : (pos.EntryPrice - closePrice) * closeQty;

            var marginToReturn = isPartial
                ? pos.InitialMargin * (closeQty / pos.Quantity)
                : pos.InitialMargin;

            var usdtAsset = await _db.Assets.FirstAsync(a => a.Symbol == "USDT", ct);
            var wallet = await _db.Wallets.FirstAsync(
                w => w.UserId == userId && w.WalletType == WalletType.Futures && w.AssetId == usdtAsset.Id, ct);
            wallet.AvailableBalance += marginToReturn + pnl;
            if (wallet.AvailableBalance < 0) wallet.AvailableBalance = 0;
            wallet.UpdatedAt = DateTime.UtcNow;

            if (isPartial)
            {
                pos.Quantity -= closeQty;
                pos.InitialMargin -= marginToReturn;
                pos.MaintenanceMargin = pos.Quantity * closePrice * MMR;
                pos.LiquidationPrice = CalculateLiquidationPrice(pos.EntryPrice, pos.Leverage, pos.Direction);
                pos.RealizedPnl += pnl;
                pos.UpdatedAt = DateTime.UtcNow;
            }
            else
            {
                pos.Status = PositionStatus.Closed;
                pos.ClosePrice = closePrice;
                pos.CloseReason = CloseReason.Manual;
                pos.RealizedPnl = pnl;
                pos.ClosedAt = DateTime.UtcNow;
                pos.UpdatedAt = DateTime.UtcNow;
                pos.Version++;
            }

            await _db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            await _notifications.NotifyPositionClosedAsync(userId, pos.Id, pos.TradingPair.Symbol, closePrice, pnl, CloseReason.Manual);
            return Result.Success();
        }
        catch { await tx.RollbackAsync(ct); throw; }
    }

    public async Task<Result> EditTpSlAsync(Guid userId, EditPositionTpSlRequest req, CancellationToken ct = default)
    {
        var pos = await _db.FuturesPositions
            .FirstOrDefaultAsync(p => p.Id == req.PositionId && p.UserId == userId, ct);
        if (pos == null) return Result.Failure("Position not found", 404);
        if (pos.Status != PositionStatus.Open) return Result.Failure("Position not open");

        pos.TakeProfit = req.TakeProfit;
        pos.StopLoss = req.StopLoss;
        pos.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Result.Success();
    }

    public async Task<Result<List<FuturesPositionDto>>> GetOpenPositionsAsync(Guid userId, CancellationToken ct = default)
    {
        var positions = await _db.FuturesPositions
            .Include(p => p.TradingPair)
            .Where(p => p.UserId == userId && p.Status == PositionStatus.Open)
            .ToListAsync(ct);
        var dtos = positions.Select(p => MapPosition(p, _priceCache.GetPrice(p.TradingPair.Symbol) ?? p.EntryPrice)).ToList();
        return Result<List<FuturesPositionDto>>.Success(dtos);
    }

    public async Task<Result<List<FuturesPositionDto>>> GetPositionHistoryAsync(Guid userId, CancellationToken ct = default)
    {
        var positions = await _db.FuturesPositions
            .Include(p => p.TradingPair)
            .Where(p => p.UserId == userId && p.Status != PositionStatus.Open)
            .OrderByDescending(p => p.ClosedAt)
            .ToListAsync(ct);
        var dtos = positions.Select(p => MapPosition(p, p.ClosePrice ?? p.EntryPrice)).ToList();
        return Result<List<FuturesPositionDto>>.Success(dtos);
    }

    public static decimal CalculateLiquidationPrice(decimal entryPrice, int leverage, Direction direction)
    {
        // Isolated margin liquidation formula
        // Long:  LiqPrice = EntryPrice * (1 - 1/leverage + MMR)
        // Short: LiqPrice = EntryPrice * (1 + 1/leverage - MMR)
        const decimal mmr = 0.005m;
        return direction == Direction.Long
            ? entryPrice * (1m - 1m / leverage + mmr)
            : entryPrice * (1m + 1m / leverage - mmr);
    }

    private static FuturesPositionDto MapPosition(FuturesPosition p, decimal markPrice) => new(
        p.Id, p.TradingPair?.Symbol ?? "", p.Direction.ToString(), p.Status.ToString(),
        p.Leverage, p.EntryPrice, p.Quantity, p.InitialMargin, p.LiquidationPrice,
        p.TakeProfit, p.StopLoss, p.Commission,
        p.CalculateUnrealizedPnl(markPrice), p.CalculateRoe(markPrice),
        markPrice, p.OpenedAt);
}
