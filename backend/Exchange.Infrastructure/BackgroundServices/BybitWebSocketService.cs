using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using Exchange.Application.DTOs.Market;
using Exchange.Application.Interfaces;
using Exchange.Infrastructure.Data;
using Exchange.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Exchange.Infrastructure.BackgroundServices;

/// <summary>
/// Connects to Bybit WebSocket v5 (spot), maintains subscriptions for all active trading pairs,
/// sends heartbeat ping every 20s, auto-reconnects with exponential back-off.
/// Feeds PriceCache and publishes events for the Matching Engine.
/// </summary>
public class BybitWebSocketService : BackgroundService
{
    private readonly ILogger<BybitWebSocketService> _logger;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly PriceCache _priceCache;

    private static readonly Uri WsUri = new("wss://stream.bybit.com/v5/public/spot");
    private const int HeartbeatIntervalMs = 20_000;
    private const int MaxRetryDelayMs = 30_000;

    // In-memory order book snapshots (symbol -> bids/asks dict price->qty)
    private readonly Dictionary<string, SortedDictionary<decimal, decimal>> _bids = new();
    private readonly Dictionary<string, SortedDictionary<decimal, decimal>> _asks = new();

    public event Action<string, decimal>? PriceUpdated;      // symbol, price
    public event Action<string, MarketTradeDto>? TradeOccurred; // symbol, trade

    public BybitWebSocketService(ILogger<BybitWebSocketService> logger,
        IServiceScopeFactory scopeFactory, PriceCache priceCache)
    {
        _logger = logger;
        _scopeFactory = scopeFactory;
        _priceCache = priceCache;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        int retryDelay = 1000;
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ConnectAndListenAsync(stoppingToken);
                retryDelay = 1000; // reset on clean disconnect
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Bybit WS disconnected. Reconnecting in {delay}ms", retryDelay);
                await Task.Delay(retryDelay, stoppingToken);
                retryDelay = Math.Min(retryDelay * 2, MaxRetryDelayMs);
            }
        }
    }

    private async Task ConnectAndListenAsync(CancellationToken ct)
    {
        using var ws = new ClientWebSocket();
        ws.Options.KeepAliveInterval = TimeSpan.FromSeconds(25);
        await ws.ConnectAsync(WsUri, ct);
        _logger.LogInformation("Bybit WS connected");

        // Load active symbols from DB
        var symbols = await GetActiveSymbolsAsync(ct);

        // Subscribe to tickers for all pairs
        var args = symbols.SelectMany(s => new[]
        {
            $"tickers.{s}",
            $"publicTrade.{s}"
        }).ToList();

        // Split into chunks of 10 subscriptions (Bybit limit)
        foreach (var chunk in args.Chunk(10))
        {
            await SendJsonAsync(ws, new { op = "subscribe", args = chunk }, ct);
        }

        // Heartbeat + read loop
        using var pingTimer = new PeriodicTimer(TimeSpan.FromMilliseconds(HeartbeatIntervalMs));
        var buffer = new byte[1024 * 64];
        var readTask = ReadLoopAsync(ws, buffer, ct);
        var pingTask = PingLoopAsync(ws, pingTimer, ct);
        await Task.WhenAny(readTask, pingTask);
    }

    private async Task ReadLoopAsync(ClientWebSocket ws, byte[] buffer, CancellationToken ct)
    {
        var sb = new StringBuilder();
        while (ws.State == WebSocketState.Open && !ct.IsCancellationRequested)
        {
            sb.Clear();
            WebSocketReceiveResult result;
            do
            {
                result = await ws.ReceiveAsync(buffer, ct);
                sb.Append(Encoding.UTF8.GetString(buffer, 0, result.Count));
            } while (!result.EndOfMessage);

            if (result.MessageType == WebSocketMessageType.Close) break;
            ProcessMessage(sb.ToString());
        }
    }

    private async Task PingLoopAsync(ClientWebSocket ws, PeriodicTimer timer, CancellationToken ct)
    {
        while (await timer.WaitForNextTickAsync(ct))
        {
            if (ws.State != WebSocketState.Open) break;
            await SendJsonAsync(ws, new { op = "ping" }, ct);
        }
    }

    private void ProcessMessage(string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            // Pong or subscription confirmation
            if (root.TryGetProperty("op", out var op) &&
                (op.GetString() == "pong" || op.GetString() == "subscribe")) return;

            if (!root.TryGetProperty("topic", out var topicEl)) return;
            var topic = topicEl.GetString() ?? "";

            if (topic.StartsWith("tickers."))
            {
                ProcessTicker(root);
            }
            else if (topic.StartsWith("publicTrade."))
            {
                ProcessPublicTrade(root, topic);
            }
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Error parsing WS message");
        }
    }

    private static decimal ParseDecimal(JsonElement el, string key)
    {
        if (!el.TryGetProperty(key, out var prop)) return 0;
        if (prop.ValueKind == JsonValueKind.Number) return prop.GetDecimal();
        if (prop.ValueKind == JsonValueKind.String &&
            decimal.TryParse(prop.GetString(), System.Globalization.NumberStyles.Any,
                System.Globalization.CultureInfo.InvariantCulture, out var val))
            return val;
        return 0;
    }

    private static long ParseLong(JsonElement el, string key)
    {
        if (!el.TryGetProperty(key, out var prop)) return 0;
        if (prop.ValueKind == JsonValueKind.Number) return prop.GetInt64();
        if (prop.ValueKind == JsonValueKind.String &&
            long.TryParse(prop.GetString(), out var val))
            return val;
        return 0;
    }

    private static string ParseString(JsonElement el, string key, string defaultVal = "")
    {
        if (!el.TryGetProperty(key, out var prop)) return defaultVal;
        if (prop.ValueKind == JsonValueKind.String) return prop.GetString() ?? defaultVal;
        return prop.ToString() ?? defaultVal;
    }

    private void ProcessTicker(JsonElement root)
    {
        if (!root.TryGetProperty("data", out var data)) return;
        var symbol = ParseString(data, "symbol");
        if (string.IsNullOrEmpty(symbol)) return;

        var ticker = new TickerData(
            symbol,
            ParseDecimal(data, "lastPrice"),
            ParseDecimal(data, "price24hPcnt") * 100,
            ParseDecimal(data, "highPrice24h"),
            ParseDecimal(data, "lowPrice24h"),
            ParseDecimal(data, "volume24h"),
            ParseDecimal(data, "turnover24h"),
            ParseDecimal(data, "bid1Price"),
            ParseDecimal(data, "ask1Price"),
            DateTime.UtcNow);

        _priceCache.UpdateFullTicker(ticker);
        PriceUpdated?.Invoke(symbol, ticker.LastPrice);
    }

    private void ProcessPublicTrade(JsonElement root, string topic)
    {
        var symbol = topic.Replace("publicTrade.", "");
        if (!root.TryGetProperty("data", out var dataArray)) return;
        if (dataArray.ValueKind != JsonValueKind.Array) return;

        foreach (var item in dataArray.EnumerateArray())
        {
            var side = ParseString(item, "S", "Buy");
            var price = ParseDecimal(item, "p");
            var qty = ParseDecimal(item, "v");
            var ts = ParseLong(item, "T");

            var trade = new MarketTradeDto(symbol, price, qty, side, ts > 0 ? ts / 1000 : DateTimeOffset.UtcNow.ToUnixTimeSeconds());
            TradeOccurred?.Invoke(symbol, trade);
        }
    }

    private async Task<List<string>> GetActiveSymbolsAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return await db.TradingPairs
            .Where(p => p.IsSpotActive || p.IsFuturesActive)
            .Select(p => p.Symbol)
            .ToListAsync(ct);
    }

    private static async Task SendJsonAsync(ClientWebSocket ws, object payload, CancellationToken ct)
    {
        var json = JsonSerializer.Serialize(payload);
        var bytes = Encoding.UTF8.GetBytes(json);
        await ws.SendAsync(bytes, WebSocketMessageType.Text, true, ct);
    }
}
