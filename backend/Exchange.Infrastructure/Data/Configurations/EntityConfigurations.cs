using Exchange.Domain.Entities;
using Exchange.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Exchange.Infrastructure.Data.Configurations;

public class AssetConfiguration : IEntityTypeConfiguration<Asset>
{
    public void Configure(EntityTypeBuilder<Asset> b)
    {
        b.ToTable("assets");
        b.HasKey(x => x.Id); b.Property(x => x.Id).HasColumnName("id");
        b.Property(x => x.Symbol).HasColumnName("symbol").HasMaxLength(20).IsRequired();
        b.Property(x => x.Name).HasColumnName("name").HasMaxLength(100).IsRequired();
        b.Property(x => x.IsBaseCurrency).HasColumnName("is_base_currency");
        b.Property(x => x.PrecisionPrice).HasColumnName("precision_price");
        b.Property(x => x.PrecisionQty).HasColumnName("precision_qty");
        b.Property(x => x.IsActive).HasColumnName("is_active");
        b.Property(x => x.CreatedAt).HasColumnName("created_at");
        b.HasIndex(x => x.Symbol).IsUnique();
    }
}

public class TradingPairConfiguration : IEntityTypeConfiguration<TradingPair>
{
    public void Configure(EntityTypeBuilder<TradingPair> b)
    {
        b.ToTable("trading_pairs");
        b.HasKey(x => x.Id); b.Property(x => x.Id).HasColumnName("id");
        b.Property(x => x.Symbol).HasColumnName("symbol").HasMaxLength(30).IsRequired();
        b.Property(x => x.BaseAssetId).HasColumnName("base_asset_id");
        b.Property(x => x.QuoteAssetId).HasColumnName("quote_asset_id");
        b.Property(x => x.MinQty).HasColumnName("min_qty").HasPrecision(28, 10);
        b.Property(x => x.MaxQty).HasColumnName("max_qty").HasPrecision(28, 10);
        b.Property(x => x.StepSize).HasColumnName("step_size").HasPrecision(28, 10);
        b.Property(x => x.MinNotional).HasColumnName("min_notional").HasPrecision(28, 10);
        b.Property(x => x.MakerFee).HasColumnName("maker_fee").HasPrecision(10, 6);
        b.Property(x => x.TakerFee).HasColumnName("taker_fee").HasPrecision(10, 6);
        b.Property(x => x.FuturesMakerFee).HasColumnName("futures_maker_fee").HasPrecision(10, 6);
        b.Property(x => x.FuturesTakerFee).HasColumnName("futures_taker_fee").HasPrecision(10, 6);
        b.Property(x => x.MaxLeverage).HasColumnName("max_leverage");
        b.Property(x => x.IsSpotActive).HasColumnName("is_spot_active");
        b.Property(x => x.IsFuturesActive).HasColumnName("is_futures_active");
        b.Property(x => x.CreatedAt).HasColumnName("created_at");
        b.HasIndex(x => x.Symbol).IsUnique();
        b.HasOne(x => x.BaseAsset).WithMany(a => a.BasePairs).HasForeignKey(x => x.BaseAssetId);
        b.HasOne(x => x.QuoteAsset).WithMany(a => a.QuotePairs).HasForeignKey(x => x.QuoteAssetId);
    }
}

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> b)
    {
        b.ToTable("users");
        b.HasKey(x => x.Id); b.Property(x => x.Id).HasColumnName("id");
        b.Property(x => x.Email).HasColumnName("email").HasMaxLength(254).IsRequired();
        b.Property(x => x.Username).HasColumnName("username").HasMaxLength(50).IsRequired();
        b.Property(x => x.PasswordHash).HasColumnName("password_hash").HasMaxLength(100).IsRequired();
        b.Property(x => x.IsEmailVerified).HasColumnName("is_email_verified");
        b.Property(x => x.IsActive).HasColumnName("is_active");
        b.Property(x => x.TwoFaEnabled).HasColumnName("two_fa_enabled");
        b.Property(x => x.TwoFaSecret).HasColumnName("two_fa_secret").HasMaxLength(100);
        b.Property(x => x.CreatedAt).HasColumnName("created_at");
        b.Property(x => x.UpdatedAt).HasColumnName("updated_at");
        b.Property(x => x.LastLoginAt).HasColumnName("last_login_at");
        b.HasIndex(x => x.Email).IsUnique();
        b.HasIndex(x => x.Username).IsUnique();
    }
}

public class RefreshTokenConfiguration : IEntityTypeConfiguration<RefreshToken>
{
    public void Configure(EntityTypeBuilder<RefreshToken> b)
    {
        b.ToTable("refresh_tokens");
        b.HasKey(x => x.Id); b.Property(x => x.Id).HasColumnName("id");
        b.Property(x => x.UserId).HasColumnName("user_id");
        b.Property(x => x.Token).HasColumnName("token").HasMaxLength(512).IsRequired();
        b.Property(x => x.ExpiresAt).HasColumnName("expires_at");
        b.Property(x => x.IsRevoked).HasColumnName("is_revoked");
        b.Property(x => x.ReplacedBy).HasColumnName("replaced_by").HasMaxLength(512);
        b.Property(x => x.CreatedAt).HasColumnName("created_at");
        b.HasIndex(x => x.Token).IsUnique();
        b.HasOne(x => x.User).WithMany(u => u.RefreshTokens).HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class WalletConfiguration : IEntityTypeConfiguration<Wallet>
{
    public void Configure(EntityTypeBuilder<Wallet> b)
    {
        b.ToTable("wallets");
        b.HasKey(x => x.Id); b.Property(x => x.Id).HasColumnName("id");
        b.Property(x => x.UserId).HasColumnName("user_id");
        b.Property(x => x.WalletType).HasColumnName("wallet_type").HasConversion<string>().HasMaxLength(10);
        b.Property(x => x.AssetId).HasColumnName("asset_id");
        b.Property(x => x.AvailableBalance).HasColumnName("available_balance").HasPrecision(28, 10);
        b.Property(x => x.LockedBalance).HasColumnName("locked_balance").HasPrecision(28, 10);
        b.Property(x => x.CreatedAt).HasColumnName("created_at");
        b.Property(x => x.UpdatedAt).HasColumnName("updated_at");
        b.Ignore(x => x.TotalBalance);
        b.HasIndex(x => new { x.UserId, x.WalletType, x.AssetId }).IsUnique();
        b.HasOne(x => x.User).WithMany(u => u.Wallets).HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.Asset).WithMany(a => a.Wallets).HasForeignKey(x => x.AssetId);
    }
}

public class CryptoAddressConfiguration : IEntityTypeConfiguration<CryptoAddress>
{
    public void Configure(EntityTypeBuilder<CryptoAddress> b)
    {
        b.ToTable("crypto_addresses");
        b.HasKey(x => x.Id); b.Property(x => x.Id).HasColumnName("id");
        b.Property(x => x.UserId).HasColumnName("user_id");
        b.Property(x => x.AssetId).HasColumnName("asset_id");
        b.Property(x => x.Network).HasColumnName("network").HasMaxLength(30).IsRequired();
        b.Property(x => x.Address).HasColumnName("address").HasMaxLength(130).IsRequired();
        b.Property(x => x.CreatedAt).HasColumnName("created_at");
        b.HasIndex(x => x.Address).IsUnique();
        b.HasIndex(x => new { x.UserId, x.AssetId, x.Network }).IsUnique();
        b.HasOne(x => x.User).WithMany(u => u.CryptoAddresses).HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.Asset).WithMany().HasForeignKey(x => x.AssetId);
    }
}

public class OrderConfiguration : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> b)
    {
        b.ToTable("orders");
        b.HasKey(x => x.Id); b.Property(x => x.Id).HasColumnName("id");
        b.Property(x => x.UserId).HasColumnName("user_id");
        b.Property(x => x.TradingPairId).HasColumnName("trading_pair_id");
        b.Property(x => x.OrderType).HasColumnName("order_type").HasConversion<string>().HasMaxLength(10);
        b.Property(x => x.MarketType).HasColumnName("market_type").HasConversion<string>().HasMaxLength(10);
        b.Property(x => x.Side).HasColumnName("side").HasConversion<string>().HasMaxLength(5);
        b.Property(x => x.Direction).HasColumnName("direction").HasConversion<string>().HasMaxLength(5);
        b.Property(x => x.Status).HasColumnName("status").HasConversion<string>().HasMaxLength(12);
        b.Property(x => x.Price).HasColumnName("price").HasPrecision(28, 10);
        b.Property(x => x.Quantity).HasColumnName("quantity").HasPrecision(28, 10);
        b.Property(x => x.FilledQuantity).HasColumnName("filled_quantity").HasPrecision(28, 10);
        b.Property(x => x.AvgFillPrice).HasColumnName("avg_fill_price").HasPrecision(28, 10);
        b.Property(x => x.Leverage).HasColumnName("leverage");
        b.Property(x => x.TakeProfit).HasColumnName("take_profit").HasPrecision(28, 10);
        b.Property(x => x.StopLoss).HasColumnName("stop_loss").HasPrecision(28, 10);
        b.Property(x => x.Commission).HasColumnName("commission").HasPrecision(28, 10);
        b.Property(x => x.LockedAmount).HasColumnName("locked_amount").HasPrecision(28, 10);
        b.Property(x => x.CreatedAt).HasColumnName("created_at");
        b.Property(x => x.UpdatedAt).HasColumnName("updated_at");
        b.Property(x => x.FilledAt).HasColumnName("filled_at");
        b.Property(x => x.ClientOrderId).HasColumnName("client_order_id").HasMaxLength(64);
        b.HasIndex(x => new { x.UserId, x.Status });
        b.HasOne(x => x.User).WithMany(u => u.Orders).HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.TradingPair).WithMany(p => p.Orders).HasForeignKey(x => x.TradingPairId);
    }
}

public class TradeConfiguration : IEntityTypeConfiguration<Trade>
{
    public void Configure(EntityTypeBuilder<Trade> b)
    {
        b.ToTable("trades");
        b.HasKey(x => x.Id); b.Property(x => x.Id).HasColumnName("id");
        b.Property(x => x.OrderId).HasColumnName("order_id");
        b.Property(x => x.UserId).HasColumnName("user_id");
        b.Property(x => x.TradingPairId).HasColumnName("trading_pair_id");
        b.Property(x => x.MarketType).HasColumnName("market_type").HasConversion<string>().HasMaxLength(10);
        b.Property(x => x.Side).HasColumnName("side").HasConversion<string>().HasMaxLength(5);
        b.Property(x => x.Direction).HasColumnName("direction").HasConversion<string>().HasMaxLength(5);
        b.Property(x => x.Price).HasColumnName("price").HasPrecision(28, 10);
        b.Property(x => x.Quantity).HasColumnName("quantity").HasPrecision(28, 10);
        b.Property(x => x.Total).HasColumnName("total").HasPrecision(28, 10);
        b.Property(x => x.Commission).HasColumnName("commission").HasPrecision(28, 10);
        b.Property(x => x.CommissionAsset).HasColumnName("commission_asset").HasMaxLength(20);
        b.Property(x => x.RealizedPnl).HasColumnName("realized_pnl").HasPrecision(28, 10);
        b.Property(x => x.CreatedAt).HasColumnName("created_at");
        b.HasOne(x => x.Order).WithMany(o => o.Trades).HasForeignKey(x => x.OrderId);
        b.HasOne(x => x.User).WithMany(u => u.Trades).HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.TradingPair).WithMany(p => p.Trades).HasForeignKey(x => x.TradingPairId);
    }
}

public class FuturesPositionConfiguration : IEntityTypeConfiguration<FuturesPosition>
{
    public void Configure(EntityTypeBuilder<FuturesPosition> b)
    {
        b.ToTable("futures_positions");
        b.HasKey(x => x.Id); b.Property(x => x.Id).HasColumnName("id");
        b.Property(x => x.UserId).HasColumnName("user_id");
        b.Property(x => x.TradingPairId).HasColumnName("trading_pair_id");
        b.Property(x => x.Direction).HasColumnName("direction").HasConversion<string>().HasMaxLength(5);
        b.Property(x => x.Status).HasColumnName("status").HasConversion<string>().HasMaxLength(12);
        b.Property(x => x.Leverage).HasColumnName("leverage");
        b.Property(x => x.EntryPrice).HasColumnName("entry_price").HasPrecision(28, 10);
        b.Property(x => x.Quantity).HasColumnName("quantity").HasPrecision(28, 10);
        b.Property(x => x.InitialMargin).HasColumnName("initial_margin").HasPrecision(28, 10);
        b.Property(x => x.MaintenanceMargin).HasColumnName("maintenance_margin").HasPrecision(28, 10);
        b.Property(x => x.LiquidationPrice).HasColumnName("liquidation_price").HasPrecision(28, 10);
        b.Property(x => x.TakeProfit).HasColumnName("take_profit").HasPrecision(28, 10);
        b.Property(x => x.StopLoss).HasColumnName("stop_loss").HasPrecision(28, 10);
        b.Property(x => x.Commission).HasColumnName("commission").HasPrecision(28, 10);
        b.Property(x => x.RealizedPnl).HasColumnName("realized_pnl").HasPrecision(28, 10);
        b.Property(x => x.ClosePrice).HasColumnName("close_price").HasPrecision(28, 10);
        b.Property(x => x.CloseReason).HasColumnName("close_reason").HasConversion<string>().HasMaxLength(20);
        b.Property(x => x.Version).HasColumnName("version").IsConcurrencyToken();
        b.Property(x => x.OpenedAt).HasColumnName("opened_at");
        b.Property(x => x.ClosedAt).HasColumnName("closed_at");
        b.Property(x => x.UpdatedAt).HasColumnName("updated_at");
        b.HasIndex(x => new { x.UserId, x.Status });
        b.HasOne(x => x.User).WithMany(u => u.Positions).HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.TradingPair).WithMany(p => p.Positions).HasForeignKey(x => x.TradingPairId);
    }
}

public class TransferConfiguration : IEntityTypeConfiguration<Transfer>
{
    public void Configure(EntityTypeBuilder<Transfer> b)
    {
        b.ToTable("transfers");
        b.HasKey(x => x.Id); b.Property(x => x.Id).HasColumnName("id");
        b.Property(x => x.TxHash).HasColumnName("tx_hash").HasMaxLength(80).IsRequired();
        b.Property(x => x.TransferType).HasColumnName("transfer_type").HasConversion<string>().HasMaxLength(15);
        b.Property(x => x.SenderUserId).HasColumnName("sender_user_id");
        b.Property(x => x.ReceiverUserId).HasColumnName("receiver_user_id");
        b.Property(x => x.AssetId).HasColumnName("asset_id");
        b.Property(x => x.Amount).HasColumnName("amount").HasPrecision(28, 10);
        b.Property(x => x.FromWalletType).HasColumnName("from_wallet_type").HasConversion<string>().HasMaxLength(10);
        b.Property(x => x.ToWalletType).HasColumnName("to_wallet_type").HasConversion<string>().HasMaxLength(10);
        b.Property(x => x.FromAddress).HasColumnName("from_address").HasMaxLength(130);
        b.Property(x => x.ToAddress).HasColumnName("to_address").HasMaxLength(130);
        b.Property(x => x.Status).HasColumnName("status").HasConversion<string>().HasMaxLength(10);
        b.Property(x => x.Note).HasColumnName("note").HasMaxLength(256);
        b.Property(x => x.CreatedAt).HasColumnName("created_at");
        b.HasIndex(x => x.TxHash).IsUnique();
        b.HasOne(x => x.SenderUser).WithMany(u => u.SentTransfers).HasForeignKey(x => x.SenderUserId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne(x => x.ReceiverUser).WithMany(u => u.ReceivedTransfers).HasForeignKey(x => x.ReceiverUserId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne(x => x.Asset).WithMany().HasForeignKey(x => x.AssetId);
    }
}

public class FavoritePairConfiguration : IEntityTypeConfiguration<FavoritePair>
{
    public void Configure(EntityTypeBuilder<FavoritePair> b)
    {
        b.ToTable("favorite_pairs");
        b.HasKey(x => new { x.UserId, x.TradingPairId });
        b.Property(x => x.UserId).HasColumnName("user_id");
        b.Property(x => x.TradingPairId).HasColumnName("trading_pair_id");
        b.Property(x => x.CreatedAt).HasColumnName("created_at");
        b.HasOne(x => x.User).WithMany(u => u.FavoritePairs).HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.TradingPair).WithMany().HasForeignKey(x => x.TradingPairId).OnDelete(DeleteBehavior.Cascade);
    }
}
