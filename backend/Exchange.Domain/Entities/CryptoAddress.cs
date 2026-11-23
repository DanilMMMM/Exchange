using Exchange.Domain.Common;

namespace Exchange.Domain.Entities;

public class CryptoAddress : BaseEntity
{
    public Guid UserId { get; set; }
    public Guid AssetId { get; set; }
    public string Network { get; set; } = string.Empty;    // BTC, ERC20, TRC20, SOL, TON
    public string Address { get; set; } = string.Empty;

    // Navigation
    public User User { get; set; } = null!;
    public Asset Asset { get; set; } = null!;
}
