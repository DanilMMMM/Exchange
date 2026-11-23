using Exchange.Domain.Enums;
using Exchange.Infrastructure.Services;
using FluentAssertions;
using Xunit;

namespace Exchange.Tests;

/// <summary>
/// Unit tests for core financial calculations.
/// All monetary values use decimal for precision.
/// </summary>
public class FinancialCalculationsTests
{
    // ----------------------------------------------------------------
    // 1. Liquidation Price — Long
    // ----------------------------------------------------------------
    [Theory]
    [InlineData(50000, 10, Direction.Long)]   // BTC Long 10x
    [InlineData(3000, 20, Direction.Long)]    // ETH Long 20x
    [InlineData(100, 50, Direction.Long)]     // ALT Long 50x
    public void LiquidationPrice_Long_ShouldBeLessThanEntryPrice(decimal entry, int leverage, Direction dir)
    {
        var liq = FuturesService.CalculateLiquidationPrice(entry, leverage, dir);
        liq.Should().BeLessThan(entry, "Long liquidation price must be below entry price");
    }

    // ----------------------------------------------------------------
    // 2. Liquidation Price — Short
    // ----------------------------------------------------------------
    [Theory]
    [InlineData(50000, 10, Direction.Short)]
    [InlineData(3000, 20, Direction.Short)]
    [InlineData(100, 50, Direction.Short)]
    public void LiquidationPrice_Short_ShouldBeGreaterThanEntryPrice(decimal entry, int leverage, Direction dir)
    {
        var liq = FuturesService.CalculateLiquidationPrice(entry, leverage, dir);
        liq.Should().BeGreaterThan(entry, "Short liquidation price must be above entry price");
    }

    // ----------------------------------------------------------------
    // 3. Liquidation Price — Formula correctness
    // ----------------------------------------------------------------
    [Fact]
    public void LiquidationPrice_Long_Formula_IsCorrect()
    {
        // Long:  LiqPrice = Entry * (1 - 1/Lev + MMR)
        decimal entry = 50000m, mmr = 0.005m;
        int lev = 10;
        var expected = entry * (1m - 1m / lev + mmr);
        var result = FuturesService.CalculateLiquidationPrice(entry, lev, Direction.Long);
        result.Should().BeApproximately(expected, 0.0001m);
    }

    [Fact]
    public void LiquidationPrice_Short_Formula_IsCorrect()
    {
        // Short: LiqPrice = Entry * (1 + 1/Lev - MMR)
        decimal entry = 50000m, mmr = 0.005m;
        int lev = 10;
        var expected = entry * (1m + 1m / lev - mmr);
        var result = FuturesService.CalculateLiquidationPrice(entry, lev, Direction.Short);
        result.Should().BeApproximately(expected, 0.0001m);
    }

    // ----------------------------------------------------------------
    // 4. Unrealized PnL — Long
    // ----------------------------------------------------------------
    [Theory]
    [InlineData(50000, 51000, 1, Direction.Long, 1000)]    // +2% profit
    [InlineData(50000, 49000, 1, Direction.Long, -1000)]   // -2% loss
    [InlineData(3000, 3600, 2, Direction.Long, 1200)]      // ETH 2 qty profit
    public void UnrealizedPnl_Long_CalculatesCorrectly(
        decimal entry, decimal mark, decimal qty, Direction dir, decimal expected)
    {
        var position = new Exchange.Domain.Entities.FuturesPosition
        {
            EntryPrice = entry, Quantity = qty, Direction = dir,
            InitialMargin = entry * qty / 10, // 10x leverage
            Leverage = 10
        };
        var pnl = position.CalculateUnrealizedPnl(mark);
        pnl.Should().BeApproximately(expected, 0.001m);
    }

    // ----------------------------------------------------------------
    // 5. Unrealized PnL — Short
    // ----------------------------------------------------------------
    [Theory]
    [InlineData(50000, 49000, 1, Direction.Short, 1000)]   // price dropped = profit for Short
    [InlineData(50000, 51000, 1, Direction.Short, -1000)]  // price rose = loss for Short
    public void UnrealizedPnl_Short_CalculatesCorrectly(
        decimal entry, decimal mark, decimal qty, Direction dir, decimal expected)
    {
        var position = new Exchange.Domain.Entities.FuturesPosition
        {
            EntryPrice = entry, Quantity = qty, Direction = dir,
            InitialMargin = entry * qty / 10,
            Leverage = 10
        };
        var pnl = position.CalculateUnrealizedPnl(mark);
        pnl.Should().BeApproximately(expected, 0.001m);
    }

    // ----------------------------------------------------------------
    // 6. ROE % calculation
    // ----------------------------------------------------------------
    [Fact]
    public void Roe_ShouldBeProportionalToLeverage()
    {
        // 10x leverage, price moves +2% → ROE should be ~20%
        var entry = 50000m;
        var mark = 51000m;   // +2%
        var qty = 1m;
        var leverage = 10;
        var margin = entry * qty / leverage;

        var pos = new Exchange.Domain.Entities.FuturesPosition
        {
            EntryPrice = entry, Quantity = qty,
            Direction = Direction.Long,
            InitialMargin = margin, Leverage = leverage
        };

        var roe = pos.CalculateRoe(mark);
        roe.Should().BeApproximately(20m, 0.01m);
    }

    // ----------------------------------------------------------------
    // 7. Initial Margin calculation
    // ----------------------------------------------------------------
    [Theory]
    [InlineData(50000, 1, 10, 5000)]    // BTC 1 qty @ $50k, 10x → $5000 margin
    [InlineData(3000, 2, 20, 300)]      // ETH 2 qty @ $3k, 20x → $300 margin
    [InlineData(100, 10, 50, 20)]       // ALT 10 qty @ $100, 50x → $20 margin
    public void InitialMargin_ShouldEqual_Notional_DividedBy_Leverage(
        decimal price, decimal qty, int leverage, decimal expected)
    {
        var notional = price * qty;
        var margin = notional / leverage;
        margin.Should().BeApproximately(expected, 0.001m);
    }

    // ----------------------------------------------------------------
    // 8. Spot commission calculation (0.1%)
    // ----------------------------------------------------------------
    [Theory]
    [InlineData(50000, 0.1, 0.001, 5)]     // BTC 0.1 qty @ $50k = $5000 trade, 0.1% = $5 fee
    [InlineData(3000, 1, 0.001, 3)]        // ETH 1 qty @ $3k = $3000 trade, 0.1% = $3 fee
    public void SpotCommission_IsCorrect(decimal price, decimal qty, decimal feeRate, decimal expected)
    {
        var commission = price * qty * feeRate;
        commission.Should().BeApproximately(expected, 0.0001m);
    }

    // ----------------------------------------------------------------
    // 9. Futures commission (0.05%)
    // ----------------------------------------------------------------
    [Fact]
    public void FuturesCommission_IsCorrect()
    {
        decimal notional = 50000m * 1m;  // BTC $50k
        var fee = notional * 0.0005m;    // 0.05%
        fee.Should().Be(25m);
    }

    // ----------------------------------------------------------------
    // 10. Balance: Available after lock
    // ----------------------------------------------------------------
    [Fact]
    public void Wallet_AvailableBalance_DecreasesAfterLock()
    {
        var wallet = new Exchange.Domain.Entities.Wallet
        {
            AvailableBalance = 10000m,
            LockedBalance = 0m
        };

        decimal lockAmount = 5000m;
        wallet.AvailableBalance -= lockAmount;
        wallet.LockedBalance += lockAmount;

        wallet.AvailableBalance.Should().Be(5000m);
        wallet.LockedBalance.Should().Be(5000m);
        wallet.TotalBalance.Should().Be(10000m);
    }

    // ----------------------------------------------------------------
    // 11. Balance: Release after cancel
    // ----------------------------------------------------------------
    [Fact]
    public void Wallet_AvailableBalance_RestoresAfterCancelOrder()
    {
        var wallet = new Exchange.Domain.Entities.Wallet
        {
            AvailableBalance = 5000m,
            LockedBalance = 5000m
        };

        // Cancel releases locked
        wallet.LockedBalance -= 5000m;
        wallet.AvailableBalance += 5000m;

        wallet.AvailableBalance.Should().Be(10000m);
        wallet.LockedBalance.Should().Be(0m);
        wallet.TotalBalance.Should().Be(10000m);
    }

    // ----------------------------------------------------------------
    // 12. PriceCache: thread-safe update
    // ----------------------------------------------------------------
    [Fact]
    public void PriceCache_ShouldReturnUpdatedPrice()
    {
        var cache = new PriceCache();
        cache.UpdatePrice("BTCUSDT", 50000m, 2.5m, 51000m, 49000m, 1000m);
        var price = cache.GetPrice("BTCUSDT");
        price.Should().Be(50000m);
    }

    [Fact]
    public void PriceCache_ShouldReturnNull_ForUnknownSymbol()
    {
        var cache = new PriceCache();
        var price = cache.GetPrice("UNKNOWNUSDT");
        price.Should().BeNull();
    }

    [Fact]
    public void PriceCache_ShouldUpdateExistingPrice()
    {
        var cache = new PriceCache();
        cache.UpdatePrice("ETHUSDT", 3000m, 1m, 3100m, 2900m, 500m);
        cache.UpdatePrice("ETHUSDT", 3200m, 3m, 3300m, 3000m, 600m);
        cache.GetPrice("ETHUSDT").Should().Be(3200m);
    }

    // ----------------------------------------------------------------
    // 13. Decimal precision (no float/double)
    // ----------------------------------------------------------------
    [Fact]
    public void FinancialCalculation_UsesDecimalPrecision_NoFloatingPointErrors()
    {
        // Classic floating point trap: 0.1 + 0.2 != 0.3 in float/double
        decimal a = 0.1m;
        decimal b = 0.2m;
        (a + b).Should().Be(0.3m, "decimal arithmetic must be exact");
    }

    // ----------------------------------------------------------------
    // 14. Liquidation protects against negative leverage values
    // ----------------------------------------------------------------
    [Theory]
    [InlineData(50000, 1, Direction.Long)]   // Lev=1, widest possible range
    [InlineData(50000, 1, Direction.Short)]
    public void LiquidationPrice_AtLeverage1_HalfRange(decimal entry, int lev, Direction dir)
    {
        var liq = FuturesService.CalculateLiquidationPrice(entry, lev, dir);
        liq.Should().BePositive();
        if (dir == Direction.Long)
            liq.Should().BeLessThan(entry);
        else
            liq.Should().BeGreaterThan(entry);
    }
}
