using Exchange.Domain.Common;

namespace Exchange.Domain.Entities;

public class TradingPair : BaseEntity
{
    public string Symbol { get; set; } = string.Empty;        // BTCUSDT
    public Guid BaseAssetId { get; set; }
    public Guid QuoteAssetId { get; set; }
    public decimal MinQty { get; set; } = 0.00001m;
    public decimal MaxQty { get; set; } = 999999999m;
    public decimal StepSize { get; set; } = 0.00001m;
    public decimal MinNotional { get; set; } = 1m;
    public decimal MakerFee { get; set; } = 0.001m;
    public decimal TakerFee { get; set; } = 0.001m;
    public decimal FuturesMakerFee { get; set; } = 0.0005m;
    public decimal FuturesTakerFee { get; set; } = 0.0005m;
    public int MaxLeverage { get; set; } = 50;
    public bool IsSpotActive { get; set; } = true;
    public bool IsFuturesActive { get; set; } = true;

    // Navigation
    public Asset BaseAsset { get; set; } = null!;
    public Asset QuoteAsset { get; set; } = null!;
    public ICollection<Order> Orders { get; set; } = new List<Order>();
    public ICollection<Trade> Trades { get; set; } = new List<Trade>();
    public ICollection<FuturesPosition> Positions { get; set; } = new List<FuturesPosition>();
}
