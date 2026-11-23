using Exchange.Application.DTOs.Market;
using Exchange.Application.Common;

namespace Exchange.Application.Interfaces;

public interface IMarketDataService
{
    Task<Result<List<TickerDto>>> GetAllTickersAsync(CancellationToken ct = default);
    Task<Result<TickerDto>> GetTickerAsync(string symbol, CancellationToken ct = default);
    Task<Result<List<KlineDto>>> GetKlinesAsync(string symbol, string interval, int limit = 300, CancellationToken ct = default);
    Task<Result<OrderBookDto>> GetOrderBookAsync(string symbol, CancellationToken ct = default);
    Task<Result<List<MarketTradeDto>>> GetRecentTradesAsync(string symbol, int limit = 50, CancellationToken ct = default);
    Task<Result<List<TradingPairInfoDto>>> GetTradingPairsAsync(CancellationToken ct = default);
    Task<Result<PortfolioAnalyticsDto>> GetPortfolioAnalyticsAsync(Guid userId, CancellationToken ct = default);
    decimal? GetCachedPrice(string symbol);
}

/// <summary>Cache for real-time prices from Bybit WebSocket</summary>
public interface IPriceCache
{
    void UpdatePrice(string symbol, decimal price, decimal changePercent, decimal high24h, decimal low24h, decimal volume24h);
    void UpdateFullTicker(TickerData data);
    decimal? GetPrice(string symbol);
    Dictionary<string, TickerData> GetAll();
}

public record TickerData(
    string Symbol,
    decimal LastPrice,
    decimal PriceChangePercent,
    decimal High24h,
    decimal Low24h,
    decimal Volume24h,
    decimal QuoteVolume24h,
    decimal BidPrice,
    decimal AskPrice,
    DateTime UpdatedAt);
