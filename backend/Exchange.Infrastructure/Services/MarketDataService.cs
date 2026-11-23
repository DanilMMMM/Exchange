using System.Text.Json;
using Exchange.Application.Common;
using Exchange.Application.DTOs.Market;
using Exchange.Application.Interfaces;
using Exchange.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Exchange.Infrastructure.Services;

public class MarketDataService : IMarketDataService
{
    private readonly AppDbContext _db;
    private readonly IPriceCache _priceCache;
    private readonly HttpClient _http;
    private readonly ILogger<MarketDataService> _logger;
    private const string BybitBase = "https://api.bybit.com";

    public MarketDataService(AppDbContext db, IPriceCache priceCache,
        IHttpClientFactory httpFactory, ILogger<MarketDataService> logger)
    {
        _db = db;
        _priceCache = priceCache;
        _http = httpFactory.CreateClient("Bybit");
        _logger = logger;
    }

    public async Task<Result<List<TickerDto>>> GetAllTickersAsync(CancellationToken ct = default)
    {
        var cached = _priceCache.GetAll();
        if (cached.Count > 0)
        {
            var dtos = cached.Values.Select(MapTicker).ToList();
            return Result<List<TickerDto>>.Success(dtos);
        }

        // Fallback: fetch from Bybit REST
        try
        {
            var json = await _http.GetStringAsync($"{BybitBase}/v5/market/tickers?category=spot", ct);
            var doc = JsonDocument.Parse(json);
            var tickers = new List<TickerDto>();
            foreach (var item in doc.RootElement.GetProperty("result").GetProperty("list").EnumerateArray())
            {
                var symbol = item.GetProperty("symbol").GetString() ?? "";
                if (!symbol.EndsWith("USDT")) continue;
                tickers.Add(new TickerDto(
                    symbol,
                    ParseDecimal(item, "lastPrice"),
                    ParseDecimal(item, "price24hPcnt") * 100,
                    ParseDecimal(item, "highPrice24h"),
                    ParseDecimal(item, "lowPrice24h"),
                    ParseDecimal(item, "volume24h"),
                    ParseDecimal(item, "turnover24h"),
                    ParseDecimal(item, "bid1Price"),
                    ParseDecimal(item, "ask1Price")));
            }
            return Result<List<TickerDto>>.Success(tickers);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch tickers from Bybit");
            return Result<List<TickerDto>>.Failure("Failed to fetch market data");
        }
    }

    public async Task<Result<TickerDto>> GetTickerAsync(string symbol, CancellationToken ct = default)
    {
        var cached = _priceCache.GetAll();
        if (cached.TryGetValue(symbol, out var t))
            return Result<TickerDto>.Success(MapTicker(t));

        try
        {
            var json = await _http.GetStringAsync($"{BybitBase}/v5/market/tickers?category=spot&symbol={symbol}", ct);
            var doc = JsonDocument.Parse(json);
            var item = doc.RootElement.GetProperty("result").GetProperty("list")[0];
            return Result<TickerDto>.Success(new TickerDto(
                symbol, ParseDecimal(item, "lastPrice"),
                ParseDecimal(item, "price24hPcnt") * 100,
                ParseDecimal(item, "highPrice24h"), ParseDecimal(item, "lowPrice24h"),
                ParseDecimal(item, "volume24h"), ParseDecimal(item, "turnover24h"),
                ParseDecimal(item, "bid1Price"), ParseDecimal(item, "ask1Price")));
        }
        catch { return Result<TickerDto>.Failure("Ticker not found", 404); }
    }

    public async Task<Result<List<KlineDto>>> GetKlinesAsync(string symbol, string interval, int limit = 300, CancellationToken ct = default)
    {
        // Map frontend intervals to Bybit intervals
        var bybitInterval = interval switch
        {
            "1m"  => "1",
            "5m"  => "5",
            "15m" => "15",
            "1h"  => "60",
            "4h"  => "240",
            "1d"  => "D",
            _     => interval
        };

        try
        {
            var url = $"{BybitBase}/v5/market/kline?category=spot&symbol={symbol}&interval={bybitInterval}&limit={limit}";
            var json = await _http.GetStringAsync(url, ct);
            var doc = JsonDocument.Parse(json);
            var list = doc.RootElement.GetProperty("result").GetProperty("list");

            var klines = new List<KlineDto>();
            foreach (var item in list.EnumerateArray())
            {
                // Bybit format: [startTime, open, high, low, close, volume, turnover]
                var arr = item.EnumerateArray().ToList();
                long.TryParse(arr[0].GetString(), out var tsMs);
                klines.Add(new KlineDto(
                    tsMs / 1000,                            // Unix seconds for TradingView
                    decimal.Parse(arr[1].GetString() ?? "0", System.Globalization.CultureInfo.InvariantCulture),
                    decimal.Parse(arr[2].GetString() ?? "0", System.Globalization.CultureInfo.InvariantCulture),
                    decimal.Parse(arr[3].GetString() ?? "0", System.Globalization.CultureInfo.InvariantCulture),
                    decimal.Parse(arr[4].GetString() ?? "0", System.Globalization.CultureInfo.InvariantCulture),
                    decimal.Parse(arr[5].GetString() ?? "0", System.Globalization.CultureInfo.InvariantCulture)));
            }

            // CRITICAL: Bybit returns newest → oldest; reverse to oldest → newest for TradingView
            klines.Reverse();
            return Result<List<KlineDto>>.Success(klines);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch klines for {symbol}", symbol);
            return Result<List<KlineDto>>.Failure("Failed to fetch kline data");
        }
    }

    public async Task<Result<OrderBookDto>> GetOrderBookAsync(string symbol, CancellationToken ct = default)
    {
        try
        {
            var url = $"{BybitBase}/v5/market/orderbook?category=spot&symbol={symbol}&limit=25";
            var json = await _http.GetStringAsync(url, ct);
            var doc = JsonDocument.Parse(json);
            var result = doc.RootElement.GetProperty("result");

            static OrderBookLevel ParseLevel(JsonElement el)
            {
                var arr = el.EnumerateArray().ToList();
                return new OrderBookLevel(
                    decimal.Parse(arr[0].GetString() ?? "0", System.Globalization.CultureInfo.InvariantCulture),
                    decimal.Parse(arr[1].GetString() ?? "0", System.Globalization.CultureInfo.InvariantCulture));
            }

            var bids = result.GetProperty("b").EnumerateArray().Select(ParseLevel).ToList();
            var asks = result.GetProperty("a").EnumerateArray().Select(ParseLevel).ToList();
            var currentPrice = _priceCache.GetPrice(symbol) ?? (bids.FirstOrDefault()?.Price ?? 0);

            return Result<OrderBookDto>.Success(new OrderBookDto(symbol, bids, asks, currentPrice));
        }
        catch { return Result<OrderBookDto>.Failure("Failed to fetch order book"); }
    }

    public async Task<Result<List<MarketTradeDto>>> GetRecentTradesAsync(string symbol, int limit = 50, CancellationToken ct = default)
    {
        try
        {
            var json = await _http.GetStringAsync($"{BybitBase}/v5/market/recent-trade?category=spot&symbol={symbol}&limit={limit}", ct);
            var doc = JsonDocument.Parse(json);
            var trades = doc.RootElement.GetProperty("result").GetProperty("list")
                .EnumerateArray()
                .Select(item => new MarketTradeDto(
                    symbol,
                    decimal.Parse(item.GetProperty("price").GetString() ?? "0", System.Globalization.CultureInfo.InvariantCulture),
                    decimal.Parse(item.GetProperty("size").GetString() ?? "0", System.Globalization.CultureInfo.InvariantCulture),
                    item.GetProperty("side").GetString() ?? "Buy",
                    long.Parse(item.GetProperty("time").GetString() ?? "0") / 1000))
                .ToList();
            return Result<List<MarketTradeDto>>.Success(trades);
        }
        catch { return Result<List<MarketTradeDto>>.Failure("Failed to fetch trades"); }
    }

    public async Task<Result<List<TradingPairInfoDto>>> GetTradingPairsAsync(CancellationToken ct = default)
    {
        var pairs = await _db.TradingPairs
            .Include(p => p.BaseAsset).Include(p => p.QuoteAsset)
            .Where(p => p.IsSpotActive || p.IsFuturesActive)
            .ToListAsync(ct);
        var dtos = pairs.Select(p => new TradingPairInfoDto(
            p.Id, p.Symbol, p.BaseAsset.Symbol, p.QuoteAsset.Symbol,
            p.BaseAsset.PrecisionPrice, p.BaseAsset.PrecisionQty,
            p.MinQty, p.MinNotional, p.MaxLeverage, p.IsSpotActive, p.IsFuturesActive)).ToList();
        return Result<List<TradingPairInfoDto>>.Success(dtos);
    }

    public async Task<Result<PortfolioAnalyticsDto>> GetPortfolioAnalyticsAsync(Guid userId, CancellationToken ct = default)
    {
        var wallets = await _db.Wallets.Include(w => w.Asset).Where(w => w.UserId == userId).ToListAsync(ct);
        var trades = await _db.Trades.Include(t => t.TradingPair).Where(t => t.UserId == userId).ToListAsync(ct);
        var positions = await _db.FuturesPositions.Where(p => p.UserId == userId).ToListAsync(ct);

        decimal totalUsdt = 0;
        var allocations = new List<AssetAllocationDto>();
        foreach (var w in wallets)
        {
            decimal val = w.Asset.Symbol == "USDT" ? w.TotalBalance : w.TotalBalance * (_priceCache.GetPrice(w.Asset.Symbol + "USDT") ?? 0);
            totalUsdt += val;
            if (val > 0) allocations.Add(new AssetAllocationDto(w.Asset.Symbol, val, 0));
        }
        // Recalculate percentages
        allocations = allocations.Select(a => a with { Percentage = totalUsdt > 0 ? a.ValueUsdt / totalUsdt * 100 : 0 }).ToList();

        var closedFuturesPnl = positions.Where(p => p.Status != Domain.Enums.PositionStatus.Open).Sum(p => p.RealizedPnl);
        var spotPnl = trades.Sum(t => t.RealizedPnl ?? 0);
        var totalPnl = closedFuturesPnl + spotPnl;
        var totalCommissions = trades.Sum(t => t.Commission);
        var winTrades = trades.Count(t => (t.RealizedPnl ?? 0) > 0);
        var lossTrades = trades.Count(t => (t.RealizedPnl ?? 0) < 0);
        var totalTrades = trades.Count;
        var winRate = totalTrades > 0 ? (decimal)winTrades / totalTrades * 100 : 0;
        var bestTrade = trades.Any() ? trades.Max(t => t.RealizedPnl ?? 0) : 0;
        var worstTrade = trades.Any() ? trades.Min(t => t.RealizedPnl ?? 0) : 0;

        // Build simple equity curve (daily)
        var equityCurve = trades
            .GroupBy(t => t.CreatedAt.Date)
            .OrderBy(g => g.Key)
            .Scan(25000m, (equity, group) => equity + group.Sum(t => t.RealizedPnl ?? 0))
            .Select((val, idx) => new EquityPointDto(DateTime.UtcNow.Date.AddDays(-trades.GroupBy(t => t.CreatedAt.Date).Count() + idx), val))
            .ToList();

        return Result<PortfolioAnalyticsDto>.Success(new PortfolioAnalyticsDto(
            totalUsdt, allocations, totalPnl, winRate, totalTrades, winTrades, lossTrades,
            bestTrade, worstTrade, totalCommissions, equityCurve));
    }

    public decimal? GetCachedPrice(string symbol) => _priceCache.GetPrice(symbol);

    private static TickerDto MapTicker(TickerData t) => new(t.Symbol, t.LastPrice, t.PriceChangePercent,
        t.High24h, t.Low24h, t.Volume24h, t.QuoteVolume24h, t.BidPrice, t.AskPrice);

    private static decimal ParseDecimal(JsonElement el, string key)
    {
        if (el.TryGetProperty(key, out var v) &&
            decimal.TryParse(v.GetString(), System.Globalization.NumberStyles.Any,
                System.Globalization.CultureInfo.InvariantCulture, out var r)) return r;
        return 0;
    }
}

// Helper extension for Scan (cumulative sum)
internal static class LinqExtensions
{
    public static IEnumerable<TAccumulate> Scan<TSource, TAccumulate>(
        this IEnumerable<TSource> source, TAccumulate seed, Func<TAccumulate, TSource, TAccumulate> func)
    {
        var acc = seed;
        foreach (var item in source)
        {
            acc = func(acc, item);
            yield return acc;
        }
    }
}
