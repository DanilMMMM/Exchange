using Exchange.Domain.Enums;

namespace Exchange.Application.Interfaces;

/// <summary>Abstraction for sending real-time notifications to frontend via SignalR</summary>
public interface INotificationService
{
    Task NotifyOrderFilledAsync(Guid userId, Guid orderId, string symbol, decimal price);
    Task NotifyPositionClosedAsync(Guid userId, Guid positionId, string symbol, decimal closePrice, decimal pnl, CloseReason reason);
    Task BroadcastTickerUpdateAsync(string symbol, decimal price, decimal changePercent);
    Task BroadcastOrderBookAsync(string symbol, object snapshot);
    Task BroadcastKlineUpdateAsync(string symbol, string interval, object kline);
    Task BroadcastMarketTradeAsync(string symbol, object trade);
    Task NotifyPositionUpdateAsync(Guid userId, string symbol);
}
