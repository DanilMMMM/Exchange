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
/// Liquidation and TP/SL engine for Futures positions.
/// Runs every 500ms. Uses optimistic concurrency (Version field).
/// </summary>
public class LiquidationEngineService : BackgroundService
{
    private readonly ILogger<LiquidationEngineService> _logger;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IPriceCache _priceCache;
    private readonly INotificationService _notifications;
    private const decimal MMR = 0.005m;  // Maintenance Margin Rate

    public LiquidationEngineService(ILogger<LiquidationEngineService> logger,
        IServiceScopeFactory scopeFactory, IPriceCache priceCache,
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
            try { await ProcessOpenPositionsAsync(stoppingToken); }
            catch (Exception ex) { _logger.LogError(ex, "Liquidation engine error"); }
        }
    }

    private async Task ProcessOpenPositionsAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var positions = await db.FuturesPositions
            .Include(p => p.TradingPair)
            .Where(p => p.Status == PositionStatus.Open)
            .ToListAsync(ct);

        foreach (var pos in positions)
        {
            var price = _priceCache.GetPrice(pos.TradingPair.Symbol);
            if (price == null) continue;

            var currentPrice = price.Value;
            CloseReason? reason = null;

            // Check liquidation
            bool isLiquidated = pos.Direction == Direction.Long
                ? currentPrice <= pos.LiquidationPrice
                : currentPrice >= pos.LiquidationPrice;
            if (isLiquidated) { reason = CloseReason.Liquidation; }

            // Check TP
            if (reason == null && pos.TakeProfit.HasValue)
            {
                bool tpHit = pos.Direction == Direction.Long
                    ? currentPrice >= pos.TakeProfit.Value
                    : currentPrice <= pos.TakeProfit.Value;
                if (tpHit) reason = CloseReason.TakeProfit;
            }

            // Check SL
            if (reason == null && pos.StopLoss.HasValue)
            {
                bool slHit = pos.Direction == Direction.Long
                    ? currentPrice <= pos.StopLoss.Value
                    : currentPrice >= pos.StopLoss.Value;
                if (slHit) reason = CloseReason.StopLoss;
            }

            if (reason.HasValue)
                await ClosePositionAsync(db, pos, currentPrice, reason.Value, ct);
        }
    }

    private async Task ClosePositionAsync(AppDbContext db, FuturesPosition pos,
        decimal closePrice, CloseReason reason, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        try
        {
            // Optimistic concurrency: check version
            var rows = await db.Database.ExecuteSqlRawAsync(
                "UPDATE futures_positions SET status = {0}, close_price = {1}, close_reason = {2}, " +
                "closed_at = NOW(), updated_at = NOW(), version = version + 1 " +
                "WHERE id = {3} AND status = 'Open' AND version = {4}",
                reason == CloseReason.Liquidation ? "Liquidated" : "Closed",
                closePrice, reason.ToString(), pos.Id, pos.Version, ct);

            if (rows == 0) { await tx.RollbackAsync(ct); return; } // already processed

            // Calculate realized PnL
            var pnl = pos.Direction == Direction.Long
                ? (closePrice - pos.EntryPrice) * pos.Quantity
                : (pos.EntryPrice - closePrice) * pos.Quantity;

            // Update realized_pnl
            await db.Database.ExecuteSqlRawAsync(
                "UPDATE futures_positions SET realized_pnl = {0} WHERE id = {1}",
                pnl, pos.Id, ct);

            // Update futures wallet
            var usdtAsset = await db.Assets.FirstAsync(a => a.Symbol == "USDT", ct);
            var wallet = await db.Wallets.FirstOrDefaultAsync(w =>
                w.UserId == pos.UserId &&
                w.WalletType == WalletType.Futures &&
                w.AssetId == usdtAsset.Id, ct);

            if (wallet != null && reason != CloseReason.Liquidation)
            {
                // Return margin + PnL (capped at 0 for losses)
                wallet.AvailableBalance += pos.InitialMargin + pnl;
                if (wallet.AvailableBalance < 0) wallet.AvailableBalance = 0;
                wallet.UpdatedAt = DateTime.UtcNow;
                await db.SaveChangesAsync(ct);
            }
            // On liquidation: margin is burnt, nothing returned

            await tx.CommitAsync(ct);
            await _notifications.NotifyPositionClosedAsync(pos.UserId, pos.Id, pos.TradingPair.Symbol, closePrice, pnl, reason);
            _logger.LogInformation("Position {id} closed: {reason} at {price}, PnL={pnl}", pos.Id, reason, closePrice, pnl);
        }
        catch (Exception ex)
        {
            await tx.RollbackAsync(ct);
            _logger.LogError(ex, "Failed to close position {id}", pos.Id);
        }
    }
}
