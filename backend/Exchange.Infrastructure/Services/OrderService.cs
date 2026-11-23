using Exchange.Application.Common;
using Exchange.Application.DTOs.Orders;
using Exchange.Application.Interfaces;
using Exchange.Domain.Entities;
using Exchange.Domain.Enums;
using Exchange.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using System.Text;

namespace Exchange.Infrastructure.Services;

public class OrderService : IOrderService
{
    private readonly AppDbContext _db;
    private readonly IPriceCache _priceCache;
    private readonly INotificationService _notifications;

    public OrderService(AppDbContext db, IPriceCache priceCache, INotificationService notifications)
    {
        _db = db;
        _priceCache = priceCache;
        _notifications = notifications;
    }

    public async Task<Result<OrderDto>> PlaceOrderAsync(Guid userId, PlaceOrderRequest req, CancellationToken ct = default)
    {
        // Validate pair
        var pair = await _db.TradingPairs
            .Include(p => p.BaseAsset)
            .Include(p => p.QuoteAsset)
            .FirstOrDefaultAsync(p => p.Symbol == req.Symbol && p.IsSpotActive, ct);
        if (pair == null) return Result<OrderDto>.Failure("Trading pair not found or not active");

        // Get current price
        var currentPrice = _priceCache.GetPrice(req.Symbol)
                        ?? throw new InvalidOperationException($"No price data for {req.Symbol}");

        decimal fillPrice = req.OrderType == OrderType.Market ? currentPrice : req.Price!.Value;

        await using var tx = await _db.Database.BeginTransactionAsync(ct);
        try
        {
            var usdtAsset = await _db.Assets.FirstAsync(a => a.Symbol == "USDT", ct);
            var fee = fillPrice * req.Quantity * pair.TakerFee;
            decimal lockedAmount;

            if (req.Side == OrderSide.Buy)
            {
                // Lock USDT
                lockedAmount = fillPrice * req.Quantity + fee;
                var quoteWallet = await _db.Wallets.FirstOrDefaultAsync(
                    w => w.UserId == userId && w.WalletType == WalletType.Spot && w.AssetId == pair.QuoteAssetId, ct);
                if (quoteWallet == null || quoteWallet.AvailableBalance < lockedAmount)
                    return Result<OrderDto>.Failure("Insufficient USDT balance");
                quoteWallet.AvailableBalance -= lockedAmount;
                quoteWallet.LockedBalance += lockedAmount;
            }
            else
            {
                // Lock base asset
                lockedAmount = req.Quantity;
                var baseWallet = await _db.Wallets.FirstOrDefaultAsync(
                    w => w.UserId == userId && w.WalletType == WalletType.Spot && w.AssetId == pair.BaseAssetId, ct);
                if (baseWallet == null || baseWallet.AvailableBalance < lockedAmount)
                    return Result<OrderDto>.Failure($"Insufficient {pair.BaseAsset.Symbol} balance");
                baseWallet.AvailableBalance -= lockedAmount;
                baseWallet.LockedBalance += lockedAmount;
            }

            var order = new Order
            {
                UserId = userId,
                TradingPairId = pair.Id,
                OrderType = req.OrderType,
                MarketType = MarketType.Spot,
                Side = req.Side,
                Price = req.OrderType == OrderType.Market ? null : req.Price,
                Quantity = req.Quantity,
                TakeProfit = req.TakeProfit,
                StopLoss = req.StopLoss,
                LockedAmount = lockedAmount,
                ClientOrderId = req.ClientOrderId
            };

            if (req.OrderType == OrderType.Market)
            {
                // Fill immediately
                order.Status = OrderStatus.Filled;
                order.FilledQuantity = req.Quantity;
                order.AvgFillPrice = fillPrice;
                order.Commission = fee;
                order.FilledAt = DateTime.UtcNow;

                // Create trade
                var trade = new Trade
                {
                    OrderId = order.Id,
                    UserId = userId,
                    TradingPairId = pair.Id,
                    MarketType = MarketType.Spot,
                    Side = req.Side,
                    Price = fillPrice,
                    Quantity = req.Quantity,
                    Total = fillPrice * req.Quantity,
                    Commission = fee,
                    CommissionAsset = "USDT"
                };
                _db.Trades.Add(trade);
                _db.Orders.Add(order);

                // Update balances
                if (req.Side == OrderSide.Buy)
                {
                    var quoteWallet = await _db.Wallets.FirstAsync(
                        w => w.UserId == userId && w.WalletType == WalletType.Spot && w.AssetId == pair.QuoteAssetId, ct);
                    var baseWallet = await EnsureWalletAsync(userId, WalletType.Spot, pair.BaseAssetId, ct);
                    quoteWallet.LockedBalance -= lockedAmount;
                    baseWallet.AvailableBalance += req.Quantity;
                }
                else
                {
                    var baseWallet = await _db.Wallets.FirstAsync(
                        w => w.UserId == userId && w.WalletType == WalletType.Spot && w.AssetId == pair.BaseAssetId, ct);
                    var quoteWallet = await EnsureWalletAsync(userId, WalletType.Spot, pair.QuoteAssetId, ct);
                    baseWallet.LockedBalance -= lockedAmount;
                    quoteWallet.AvailableBalance += fillPrice * req.Quantity - fee;
                }
            }
            else
            {
                // Limit order: stays open
                _db.Orders.Add(order);
            }

            await _db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);

            if (order.Status == OrderStatus.Filled)
                await _notifications.NotifyOrderFilledAsync(userId, order.Id, pair.Symbol, fillPrice);

            return Result<OrderDto>.Success(MapOrder(order, pair.Symbol), 201);
        }
        catch (Exception)
        {
            await tx.RollbackAsync(ct);
            throw;
        }
    }

    public async Task<Result> CancelOrderAsync(Guid userId, Guid orderId, CancellationToken ct = default)
    {
        await using var tx = await _db.Database.BeginTransactionAsync(ct);
        try
        {
            var order = await _db.Orders
                .Include(o => o.TradingPair).ThenInclude(p => p.BaseAsset)
                .Include(o => o.TradingPair).ThenInclude(p => p.QuoteAsset)
                .FirstOrDefaultAsync(o => o.Id == orderId && o.UserId == userId, ct);
            if (order == null) return Result.Failure("Order not found", 404);
            if (order.Status != OrderStatus.Open) return Result.Failure("Order is not open");

            order.Status = OrderStatus.Cancelled;
            order.UpdatedAt = DateTime.UtcNow;

            // Return locked funds
            if (order.Side == OrderSide.Buy)
            {
                var quoteWallet = await _db.Wallets.FirstAsync(
                    w => w.UserId == userId && w.WalletType == WalletType.Spot && w.AssetId == order.TradingPair.QuoteAssetId, ct);
                quoteWallet.LockedBalance -= order.LockedAmount;
                quoteWallet.AvailableBalance += order.LockedAmount;
            }
            else
            {
                var baseWallet = await _db.Wallets.FirstAsync(
                    w => w.UserId == userId && w.WalletType == WalletType.Spot && w.AssetId == order.TradingPair.BaseAssetId, ct);
                baseWallet.LockedBalance -= order.LockedAmount;
                baseWallet.AvailableBalance += order.LockedAmount;
            }

            await _db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            return Result.Success();
        }
        catch { await tx.RollbackAsync(ct); throw; }
    }

    public async Task<Result<List<OrderDto>>> GetOpenOrdersAsync(Guid userId, CancellationToken ct = default)
    {
        var orders = await _db.Orders
            .Include(o => o.TradingPair)
            .Where(o => o.UserId == userId && o.Status == OrderStatus.Open && o.MarketType == MarketType.Spot)
            .OrderByDescending(o => o.CreatedAt)
            .ToListAsync(ct);
        return Result<List<OrderDto>>.Success(orders.Select(o => MapOrder(o, o.TradingPair.Symbol)).ToList());
    }

    public async Task<Result<List<OrderDto>>> GetOrderHistoryAsync(Guid userId, int page = 1, int pageSize = 50, CancellationToken ct = default)
    {
        var orders = await _db.Orders
            .Include(o => o.TradingPair)
            .Where(o => o.UserId == userId && o.MarketType == MarketType.Spot)
            .OrderByDescending(o => o.CreatedAt)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .ToListAsync(ct);
        return Result<List<OrderDto>>.Success(orders.Select(o => MapOrder(o, o.TradingPair.Symbol)).ToList());
    }

    public async Task<Result<List<TradeDto>>> GetTradeHistoryAsync(Guid userId, int page = 1, int pageSize = 50, CancellationToken ct = default)
    {
        var trades = await _db.Trades
            .Include(t => t.TradingPair)
            .Where(t => t.UserId == userId)
            .OrderByDescending(t => t.CreatedAt)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .ToListAsync(ct);
        return Result<List<TradeDto>>.Success(trades.Select(MapTrade).ToList());
    }

    public async Task<Result<byte[]>> ExportTradesToCsvAsync(Guid userId, CancellationToken ct = default)
    {
        var trades = await _db.Trades
            .Include(t => t.TradingPair)
            .Where(t => t.UserId == userId)
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync(ct);

        var sb = new StringBuilder();
        sb.AppendLine("Date,Symbol,MarketType,Side,Price,Quantity,Total,Commission,RealizedPnL");
        foreach (var t in trades)
            sb.AppendLine($"{t.CreatedAt:yyyy-MM-dd HH:mm:ss},{t.TradingPair.Symbol},{t.MarketType},{t.Side}," +
                          $"{t.Price},{t.Quantity},{t.Total},{t.Commission},{t.RealizedPnl}");

        return Result<byte[]>.Success(Encoding.UTF8.GetBytes(sb.ToString()));
    }

    private async Task<Wallet> EnsureWalletAsync(Guid userId, WalletType type, Guid assetId, CancellationToken ct)
    {
        var w = await _db.Wallets.FirstOrDefaultAsync(x =>
            x.UserId == userId && x.WalletType == type && x.AssetId == assetId, ct);
        if (w == null)
        {
            w = new Wallet { UserId = userId, WalletType = type, AssetId = assetId };
            _db.Wallets.Add(w);
        }
        return w;
    }

    private static OrderDto MapOrder(Order o, string symbol) => new(
        o.Id, symbol, o.OrderType.ToString(), o.MarketType.ToString(),
        o.Side.ToString(), o.Direction?.ToString(), o.Status.ToString(),
        o.Price, o.Quantity, o.FilledQuantity, o.AvgFillPrice,
        o.Leverage, o.TakeProfit, o.StopLoss, o.Commission,
        o.CreatedAt, o.FilledAt);

    private static TradeDto MapTrade(Trade t) => new(
        t.Id, t.TradingPair?.Symbol ?? "", t.MarketType.ToString(), t.Side.ToString(),
        t.Direction?.ToString(), t.Price, t.Quantity, t.Total,
        t.Commission, t.RealizedPnl, t.CreatedAt);
}
