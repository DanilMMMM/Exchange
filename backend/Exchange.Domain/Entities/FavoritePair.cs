using Exchange.Domain.Common;

namespace Exchange.Domain.Entities;

public class FavoritePair
{
    public Guid UserId { get; set; }
    public Guid TradingPairId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public User User { get; set; } = null!;
    public TradingPair TradingPair { get; set; } = null!;
}
