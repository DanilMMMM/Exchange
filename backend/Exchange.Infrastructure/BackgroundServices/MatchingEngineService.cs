using Exchange.Application.Interfaces;
using Exchange.Domain.Entities;
using Exchange.Domain.Enums;
using Exchange.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Exchange.Infrastructure.BackgroundServices;

/// <summary>
/// Matching Engine: watches real-time prices and fills open limit orders.
/// Runs every 500ms. Uses DB transactions with row-level locking.
/// </summary>
public class MatchingEngineService : BackgroundService
{
    private readonly ILogger<MatchingEngineService> _logger;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IPriceCache _priceCache;
    private readonly INotificationService _notifications;

    public MatchingEngineService(ILogger<MatchingEngineService> logger,
        IServiceScopeFactory scopeFactory,
        IPriceCache priceCache,
        INotificationService notifications)
    {
        _logger = logger;
        _scopeFactory = scopeFactory;
        _priceCache = priceCache;
        _notifications = notifications;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMilliseconds(500));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try { await ProcessOpenOrdersAsync(stoppingToken); }
            catch (Exception ex) { _logger.LogError(ex, "Matching engine error"); }
        }
    }

    private async Task ProcessOpenOrdersAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        // Load open limit spot orders with their trading pair
        var openOrders = await db.Orders
            .Include(o => o.TradingPair)
                .ThenInclude(p => p.BaseAsset)
            .Include(o => o.TradingPair)
                .ThenInclude(p => p.QuoteAsset)
            .Where(o => o.Status == OrderStatus.Open
                     && o.OrderType == OrderType.Limit
                     && o.MarketType == MarketType.Spot)
            .ToListAsync(ct);

        foreach (var order in openOrders)
        {
            var currentPrice = _priceCache.GetPrice(order.TradingPair.Symbol);
            if (currentPrice == null) continue;

            bool shouldFill = order.Side == OrderSide.Buy
                ? currentPrice <= order.Price
                : currentPrice >= order.Price;

            if (shouldFill)
                await FillOrderAsync(db, order, currentPrice.Value, ct);
        }
    }

    private async Task FillOrderAsync(AppDbContext db, Order order, decimal fillPrice, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        try
        {
            // Re-fetch with lock
            var locked = await db.Orders
                .FromSqlRaw("SELECT * FROM orders WHERE id = {0} FOR UPDATE", order.Id)
                .FirstOrDefaultAsync(ct);
            if (locked == null || locked.Status != OrderStatus.Open) return;

            var pair = await db.TradingPairs
                .Include(p => p.BaseAsset)
                .Include(p => p.QuoteAsset)
                .FirstAsync(p => p.Id == order.TradingPairId, ct);

            var fee = fillPrice * order.Quantity * pair.MakerFee;

            // Update order
            locked.Status = OrderStatus.Filled;
            locked.FilledQuantity = locked.Quantity;
            locked.AvgFillPrice = fillPrice;
            locked.Commission = fee;
            locked.FilledAt = DateTime.UtcNow;
            locked.UpdatedAt = DateTime.UtcNow;

            // Create trade
            var trade = new Trade
            {
                OrderId = locked.Id,
                UserId = locked.UserId,
                TradingPairId = locked.TradingPairId,
                MarketType = MarketType.Spot,
                Side = locked.Side,
                Price = fillPrice,
                Quantity = locked.Quantity,
                Total = fillPrice * locked.Quantity,
                Commission = fee,
                CommissionAsset = pair.QuoteAsset.Symbol
            };
            db.Trades.Add(trade);

            // Update wallets
            if (locked.Side == OrderSide.Buy)
            {
                // Buyer: locked USDT → release and subtract; receive base asset
                var quoteWallet = await GetWalletAsync(db, locked.UserId, WalletType.Spot, pair.QuoteAssetId, ct);
                var baseWallet = await GetOrCreateWalletAsync(db, locked.UserId, WalletType.Spot, pair.BaseAssetId, ct);
                quoteWallet.LockedBalance -= locked.LockedAmount;
                // Any overpayment/underpayment due to price difference already locked at limit price
                var actualCost = fillPrice * locked.Quantity + fee;
                var refund = locked.LockedAmount - actualCost;
                if (refund > 0) quoteWallet.AvailableBalance += refund;
                baseWallet.AvailableBalance += locked.Quantity;
            }
            else
            {
                // Seller: locked base asset → release; receive USDT
                var baseWallet = await GetWalletAsync(db, locked.UserId, WalletType.Spot, pair.BaseAssetId, ct);
                var quoteWallet = await GetOrCreateWalletAsync(db, locked.UserId, WalletType.Spot, pair.QuoteAssetId, ct);
                baseWallet.LockedBalance -= locked.LockedAmount;
                quoteWallet.AvailableBalance += fillPrice * locked.Quantity - fee;
            }

            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);

            await _notifications.NotifyOrderFilledAsync(locked.UserId, locked.Id, pair.Symbol, fillPrice);
            _logger.LogInformation("Order {id} filled at {price}", locked.Id, fillPrice);
        }
        catch (Exception ex)
        {
            await tx.RollbackAsync(ct);
            _logger.LogError(ex, "Failed to fill order {id}", order.Id);
        }
    }

    private async Task<Wallet> GetWalletAsync(AppDbContext db, Guid userId,
        WalletType type, Guid assetId, CancellationToken ct)
        => await db.Wallets.FirstAsync(w =>
            w.UserId == userId && w.WalletType == type && w.AssetId == assetId, ct);

    private async Task<Wallet> GetOrCreateWalletAsync(AppDbContext db, Guid userId,
        WalletType type, Guid assetId, CancellationToken ct)
    {
        var w = await db.Wallets.FirstOrDefaultAsync(x =>
            x.UserId == userId && x.WalletType == type && x.AssetId == assetId, ct);
        if (w == null)
        {
            w = new Wallet { UserId = userId, WalletType = type, AssetId = assetId };
            db.Wallets.Add(w);
        }
        return w;
    }
}
