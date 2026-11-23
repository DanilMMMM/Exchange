using Exchange.Application.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace Exchange.API.Controllers;

[ApiController]
[Route("api/market")]
public class MarketController : ControllerBase
{
    private readonly IMarketDataService _market;
    public MarketController(IMarketDataService market) => _market = market;

    /// <summary>Get all trading pairs</summary>
    [HttpGet("pairs")]
    public async Task<IActionResult> GetPairs(CancellationToken ct)
    {
        var result = await _market.GetTradingPairsAsync(ct);
        return Ok(result.Data);
    }

    /// <summary>Get all live tickers</summary>
    [HttpGet("tickers")]
    public async Task<IActionResult> GetTickers(CancellationToken ct)
    {
        var result = await _market.GetAllTickersAsync(ct);
        return Ok(result.Data);
    }

    /// <summary>Get single ticker</summary>
    [HttpGet("tickers/{symbol}")]
    public async Task<IActionResult> GetTicker(string symbol, CancellationToken ct)
    {
        var result = await _market.GetTickerAsync(symbol, ct);
        return result.IsSuccess ? Ok(result.Data) : NotFound(new { error = result.Error });
    }

    /// <summary>Get kline/candlestick data (intervals: 1m, 5m, 15m, 1h, 4h, 1d)</summary>
    [HttpGet("klines/{symbol}")]
    public async Task<IActionResult> GetKlines(string symbol,
        [FromQuery] string interval = "1h",
        [FromQuery] int limit = 300,
        CancellationToken ct = default)
    {
        var result = await _market.GetKlinesAsync(symbol, interval, limit, ct);
        return result.IsSuccess ? Ok(result.Data) : BadRequest(new { error = result.Error });
    }

    /// <summary>Get live order book snapshot</summary>
    [HttpGet("orderbook/{symbol}")]
    public async Task<IActionResult> GetOrderBook(string symbol, CancellationToken ct)
    {
        var result = await _market.GetOrderBookAsync(symbol, ct);
        return result.IsSuccess ? Ok(result.Data) : BadRequest(new { error = result.Error });
    }

    /// <summary>Get recent market trades</summary>
    [HttpGet("trades/{symbol}")]
    public async Task<IActionResult> GetTrades(string symbol,
        [FromQuery] int limit = 50, CancellationToken ct = default)
    {
        var result = await _market.GetRecentTradesAsync(symbol, limit, ct);
        return Ok(result.Data);
    }
}

[ApiController]
[Route("api/analytics")]
[Microsoft.AspNetCore.Authorization.Authorize]
public class AnalyticsController : Exchange.API.Controllers.BaseController
{
    private readonly IMarketDataService _market;
    public AnalyticsController(IMarketDataService market) => _market = market;

    /// <summary>Get portfolio analytics and equity curve</summary>
    [HttpGet("portfolio")]
    public async Task<IActionResult> GetPortfolio(CancellationToken ct)
    {
        var result = await _market.GetPortfolioAnalyticsAsync(CurrentUserId, ct);
        return Ok(result.Data);
    }
}
