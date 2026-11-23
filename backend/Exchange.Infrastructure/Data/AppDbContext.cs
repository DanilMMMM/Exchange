using Exchange.Domain.Entities;
using Exchange.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Exchange.Infrastructure.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Asset> Assets => Set<Asset>();
    public DbSet<TradingPair> TradingPairs => Set<TradingPair>();
    public DbSet<User> Users => Set<User>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<Wallet> Wallets => Set<Wallet>();
    public DbSet<CryptoAddress> CryptoAddresses => Set<CryptoAddress>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<Trade> Trades => Set<Trade>();
    public DbSet<FuturesPosition> FuturesPositions => Set<FuturesPosition>();
    public DbSet<Transfer> Transfers => Set<Transfer>();
    public DbSet<FavoritePair> FavoritePairs => Set<FavoritePair>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}
