using Exchange.Domain.Common;
using Exchange.Domain.Enums;

namespace Exchange.Domain.Entities;

public class Wallet : BaseEntity
{
    public Guid UserId { get; set; }
    public WalletType WalletType { get; set; }
    public Guid AssetId { get; set; }
    public decimal AvailableBalance { get; set; }
    public decimal LockedBalance { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public decimal TotalBalance => AvailableBalance + LockedBalance;

    // Navigation
    public User User { get; set; } = null!;
    public Asset Asset { get; set; } = null!;
}
