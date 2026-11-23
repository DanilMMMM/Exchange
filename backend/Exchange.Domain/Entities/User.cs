using Exchange.Domain.Common;

namespace Exchange.Domain.Entities;

public class User : AuditableEntity
{
    public string Email { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public bool IsEmailVerified { get; set; }
    public bool IsActive { get; set; } = true;
    public bool TwoFaEnabled { get; set; }
    public string? TwoFaSecret { get; set; }
    public DateTime? LastLoginAt { get; set; }

    // Navigation
    public ICollection<Wallet> Wallets { get; set; } = new List<Wallet>();
    public ICollection<Order> Orders { get; set; } = new List<Order>();
    public ICollection<Trade> Trades { get; set; } = new List<Trade>();
    public ICollection<FuturesPosition> Positions { get; set; } = new List<FuturesPosition>();
    public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
    public ICollection<CryptoAddress> CryptoAddresses { get; set; } = new List<CryptoAddress>();
    public ICollection<Transfer> SentTransfers { get; set; } = new List<Transfer>();
    public ICollection<Transfer> ReceivedTransfers { get; set; } = new List<Transfer>();
    public ICollection<FavoritePair> FavoritePairs { get; set; } = new List<FavoritePair>();
}
