using Exchange.Application.DTOs.Orders;
using Exchange.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Exchange.API.Controllers;

[ApiController]
[Route("api/futures")]
[Authorize]
public class FuturesController : BaseController
{
    private readonly IFuturesService _futures;
    public FuturesController(IFuturesService futures) => _futures = futures;

    /// <summary>Open a futures position (Long/Short, Market/Limit, leverage 1-50x)</summary>
    [HttpPost("positions")]
    public async Task<IActionResult> OpenPosition([FromBody] PlaceOrderRequest req, CancellationToken ct)
    {
        var result = await _futures.OpenPositionAsync(CurrentUserId, req, ct);
        return result.IsSuccess ? StatusCode(result.StatusCode, result.Data) : StatusCode(result.StatusCode, new { error = result.Error });
    }

    /// <summary>Close a position (fully or partially)</summary>
    [HttpPost("positions/close")]
    public async Task<IActionResult> ClosePosition([FromBody] ClosePositionRequest req, CancellationToken ct)
    {
        var result = await _futures.ClosePositionAsync(CurrentUserId, req, ct);
        return result.IsSuccess ? Ok() : StatusCode(result.StatusCode, new { error = result.Error });
    }

    /// <summary>Edit TP/SL for an open position</summary>
    [HttpPatch("positions/tpsl")]
    public async Task<IActionResult> EditTpSl([FromBody] EditPositionTpSlRequest req, CancellationToken ct)
    {
        var result = await _futures.EditTpSlAsync(CurrentUserId, req, ct);
        return result.IsSuccess ? Ok() : StatusCode(result.StatusCode, new { error = result.Error });
    }

    /// <summary>Get open futures positions</summary>
    [HttpGet("positions")]
    public async Task<IActionResult> GetOpenPositions(CancellationToken ct)
    {
        var result = await _futures.GetOpenPositionsAsync(CurrentUserId, ct);
        return Ok(result.Data);
    }

    /// <summary>Get futures position history (closed/liquidated)</summary>
    [HttpGet("positions/history")]
    public async Task<IActionResult> GetPositionHistory(CancellationToken ct)
    {
        var result = await _futures.GetPositionHistoryAsync(CurrentUserId, ct);
        return Ok(result.Data);
    }
}
