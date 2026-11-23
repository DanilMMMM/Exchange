using Exchange.Domain.Common;
using Exchange.Domain.Enums;

namespace Exchange.Domain.Entities;

public class FuturesPosition : BaseEntity
{
    public Guid UserId { get; set; }
    public Guid TradingPairId { get; set; }
    public Direction Direction { get; set; }
    public PositionStatus Status { get; set; } = PositionStatus.Open;
    public int Leverage { get; set; }
    public decimal EntryPrice { get; set; }
    public decimal Quantity { get; set; }
    public decimal InitialMargin { get; set; }
    public decimal MaintenanceMargin { get; set; }
    public decimal LiquidationPrice { get; set; }
    public decimal? TakeProfit { get; set; }
    public decimal? StopLoss { get; set; }
    public decimal Commission { get; set; }
    public decimal RealizedPnl { get; set; }
    public decimal? ClosePrice { get; set; }
    public CloseReason? CloseReason { get; set; }
    public int Version { get; set; }                  // Optimistic concurrency
    public DateTime OpenedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ClosedAt { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public User User { get; set; } = null!;
    public TradingPair TradingPair { get; set; } = null!;

    /// <summary>Unrealized PnL at current market price (not stored, computed in-memory)</summary>
    public decimal CalculateUnrealizedPnl(decimal currentPrice)
    {
        var positionNotional = Quantity * currentPrice;
        var entryNotional = Quantity * EntryPrice;
        return Direction == Direction.Long
            ? positionNotional - entryNotional
            : entryNotional - positionNotional;
    }

    /// <summary>ROE % = UnrealizedPnL / InitialMargin * 100</summary>
    public decimal CalculateRoe(decimal currentPrice)
    {
        if (InitialMargin == 0) return 0;
        return CalculateUnrealizedPnl(currentPrice) / InitialMargin * 100m;
    }
}
