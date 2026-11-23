using Exchange.Domain.Common;

namespace Exchange.Domain.Entities;

public class Asset : BaseEntity
{
    public string Symbol { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public bool IsBaseCurrency { get; set; }
    public int PrecisionPrice { get; set; } = 2;
    public int PrecisionQty { get; set; } = 6;
    public bool IsActive { get; set; } = true;

    // Navigation
    public ICollection<TradingPair> BasePairs { get; set; } = new List<TradingPair>();
    public ICollection<TradingPair> QuotePairs { get; set; } = new List<TradingPair>();
    public ICollection<Wallet> Wallets { get; set; } = new List<Wallet>();
}
