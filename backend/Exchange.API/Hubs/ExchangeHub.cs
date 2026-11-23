using Exchange.Application.Interfaces;
using Exchange.Domain.Enums;
using Microsoft.AspNetCore.SignalR;

namespace Exchange.API.Hubs;

public class ExchangeHub : Hub
{
    // Groups: "market:{symbol}", "user:{userId}"
    public async Task SubscribeToMarket(string symbol)
        => await Groups.AddToGroupAsync(Context.ConnectionId, $"market:{symbol}");

    public async Task UnsubscribeFromMarket(string symbol)
        => await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"market:{symbol}");

    public async Task SubscribeToUser(string userId)
        => await Groups.AddToGroupAsync(Context.ConnectionId, $"user:{userId}");
}

public class NotificationService : INotificationService
{
    private readonly IHubContext<ExchangeHub> _hub;
    public NotificationService(IHubContext<ExchangeHub> hub) => _hub = hub;

    public async Task NotifyOrderFilledAsync(Guid userId, Guid orderId, string symbol, decimal price)
        => await _hub.Clients.Group($"user:{userId}").SendAsync("OrderFilled",
            new { orderId, symbol, price, type = "success", message = $"Order filled: {symbol} @ {price:F4}" });

    public async Task NotifyPositionClosedAsync(Guid userId, Guid positionId, string symbol,
        decimal closePrice, decimal pnl, CloseReason reason)
        => await _hub.Clients.Group($"user:{userId}").SendAsync("PositionClosed",
            new { positionId, symbol, closePrice, pnl, reason = reason.ToString(),
                  type = reason == CloseReason.Liquidation ? "error" : pnl >= 0 ? "success" : "warning",
                  message = $"Position {reason}: {symbol} PnL {pnl:+0.00;-0.00} USDT" });

    public async Task BroadcastTickerUpdateAsync(string symbol, decimal price, decimal changePercent)
        => await _hub.Clients.Group($"market:{symbol}").SendAsync("TickerUpdate",
            new { symbol, price, changePercent, timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds() });

    public async Task BroadcastOrderBookAsync(string symbol, object snapshot)
        => await _hub.Clients.Group($"market:{symbol}").SendAsync("OrderBookUpdate", snapshot);

    public async Task BroadcastKlineUpdateAsync(string symbol, string interval, object kline)
        => await _hub.Clients.Group($"market:{symbol}").SendAsync("KlineUpdate",
            new { symbol, interval, kline });

    public async Task BroadcastMarketTradeAsync(string symbol, object trade)
        => await _hub.Clients.Group($"market:{symbol}").SendAsync("MarketTrade", trade);

    public async Task NotifyPositionUpdateAsync(Guid userId, string symbol)
        => await _hub.Clients.Group($"user:{userId}").SendAsync("PositionUpdate", new { symbol });
}
