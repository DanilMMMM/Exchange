using Exchange.Domain.Common;
using Exchange.Domain.Enums;

namespace Exchange.Domain.Entities;

public class Order : AuditableEntity
{
    public Guid UserId { get; set; }
    public Guid TradingPairId { get; set; }
    public OrderType OrderType { get; set; }
    public MarketType MarketType { get; set; }
    public OrderSide Side { get; set; }
    public Direction? Direction { get; set; }         // Futures only
    public OrderStatus Status { get; set; } = OrderStatus.Open;
    public decimal? Price { get; set; }               // null for Market
    public decimal Quantity { get; set; }
    public decimal FilledQuantity { get; set; }
    public decimal? AvgFillPrice { get; set; }
    public int? Leverage { get; set; }                // Futures only
    public decimal? TakeProfit { get; set; }
    public decimal? StopLoss { get; set; }
    public decimal Commission { get; set; }
    public decimal LockedAmount { get; set; }         // Frozen during open
    public DateTime? FilledAt { get; set; }
    public string? ClientOrderId { get; set; }

    // Navigation
    public User User { get; set; } = null!;
    public TradingPair TradingPair { get; set; } = null!;
    public ICollection<Trade> Trades { get; set; } = new List<Trade>();
}
