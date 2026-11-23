using Exchange.Domain.Common;
using Exchange.Domain.Enums;

namespace Exchange.Domain.Entities;

public class Transfer : BaseEntity
{
    public string TxHash { get; set; } = Guid.NewGuid().ToString("N") + Guid.NewGuid().ToString("N");
    public TransferType TransferType { get; set; }
    public Guid? SenderUserId { get; set; }
    public Guid? ReceiverUserId { get; set; }
    public Guid AssetId { get; set; }
    public decimal Amount { get; set; }
    // BetweenAccounts
    public WalletType? FromWalletType { get; set; }
    public WalletType? ToWalletType { get; set; }
    // Internal (between users)
    public string? FromAddress { get; set; }
    public string? ToAddress { get; set; }
    public TransferStatus Status { get; set; } = TransferStatus.Completed;
    public string? Note { get; set; }

    // Navigation
    public User? SenderUser { get; set; }
    public User? ReceiverUser { get; set; }
    public Asset Asset { get; set; } = null!;
}
