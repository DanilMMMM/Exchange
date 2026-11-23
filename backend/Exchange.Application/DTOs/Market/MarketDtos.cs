namespace Exchange.Application.DTOs.Market;

public record TickerDto(
    string Symbol,
    decimal LastPrice,
    decimal PriceChangePercent,
    decimal High24h,
    decimal Low24h,
    decimal Volume24h,
    decimal QuoteVolume24h,
    decimal BidPrice,
    decimal AskPrice);

public record KlineDto(
    long Time,          // Unix seconds (для TradingView)
    decimal Open,
    decimal High,
    decimal Low,
    decimal Close,
    decimal Volume);

public record OrderBookDto(
    string Symbol,
    List<OrderBookLevel> Bids,
    List<OrderBookLevel> Asks,
    decimal LastPrice);

public record OrderBookLevel(decimal Price, decimal Quantity);

public record MarketTradeDto(
    string Symbol,
    decimal Price,
    decimal Quantity,
    string Side,
    long Time);

public record TradingPairInfoDto(
    Guid Id,
    string Symbol,
    string BaseAsset,
    string QuoteAsset,
    int PrecisionPrice,
    int PrecisionQty,
    decimal MinQty,
    decimal MinNotional,
    int MaxLeverage,
    bool IsSpotActive,
    bool IsFuturesActive);

public record PortfolioAnalyticsDto(
    decimal TotalValueUsdt,
    List<AssetAllocationDto> Allocations,
    decimal TotalRealizedPnl,
    decimal WinRate,
    int TotalTrades,
    int WinTrades,
    int LossTrades,
    decimal BestTrade,
    decimal WorstTrade,
    decimal TotalCommissions,
    List<EquityPointDto> EquityCurve);

public record AssetAllocationDto(string Symbol, decimal ValueUsdt, decimal Percentage);
public record EquityPointDto(DateTime Date, decimal EquityUsdt);
