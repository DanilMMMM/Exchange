using Exchange.Domain.Common;
using Exchange.Domain.Enums;

namespace Exchange.Domain.Entities;

public class Trade : BaseEntity
{
    public Guid OrderId { get; set; }
    public Guid UserId { get; set; }
    public Guid TradingPairId { get; set; }
    public MarketType MarketType { get; set; }
    public OrderSide Side { get; set; }
    public Direction? Direction { get; set; }
    public decimal Price { get; set; }
    public decimal Quantity { get; set; }
    public decimal Total { get; set; }                // Price * Quantity
    public decimal Commission { get; set; }
    public string CommissionAsset { get; set; } = "USDT";
    public decimal? RealizedPnl { get; set; }         // Futures closing trades

    // Navigation
    public Order Order { get; set; } = null!;
    public User User { get; set; } = null!;
    public TradingPair TradingPair { get; set; } = null!;
}
