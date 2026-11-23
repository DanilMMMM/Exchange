using System.Collections.Concurrent;
using Exchange.Application.DTOs.Market;
using Exchange.Application.Interfaces;

namespace Exchange.Infrastructure.Services;

/// <summary>Thread-safe in-memory price cache fed by Bybit WebSocket</summary>
public class PriceCache : IPriceCache
{
    private readonly ConcurrentDictionary<string, TickerData> _cache = new();

    public void UpdatePrice(string symbol, decimal price, decimal changePercent,
        decimal high24h, decimal low24h, decimal volume24h)
    {
        var existing = _cache.GetValueOrDefault(symbol);
        _cache[symbol] = new TickerData(
            symbol, price, changePercent, high24h, low24h, volume24h,
            existing?.QuoteVolume24h ?? 0,
            existing?.BidPrice ?? price,
            existing?.AskPrice ?? price,
            DateTime.UtcNow);
    }

    public void UpdateFullTicker(TickerData data) => _cache[data.Symbol] = data;

    public decimal? GetPrice(string symbol)
        => _cache.TryGetValue(symbol, out var t) ? t.LastPrice : null;

    public Dictionary<string, TickerData> GetAll() => new(_cache);
}
