using Exchange.Application.DTOs.Orders;
using Exchange.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Exchange.API.Controllers;

[ApiController]
[Route("api/orders")]
[Authorize]
public class OrdersController : BaseController
{
    private readonly IOrderService _orders;
    public OrdersController(IOrderService orders) => _orders = orders;

    /// <summary>Place a spot order (Market or Limit)</summary>
    [HttpPost]
    public async Task<IActionResult> PlaceOrder([FromBody] PlaceOrderRequest req, CancellationToken ct)
    {
        var result = await _orders.PlaceOrderAsync(CurrentUserId, req, ct);
        return result.IsSuccess ? StatusCode(result.StatusCode, result.Data) : StatusCode(result.StatusCode, new { error = result.Error });
    }

    /// <summary>Cancel an open limit order</summary>
    [HttpDelete("{orderId}")]
    public async Task<IActionResult> CancelOrder(Guid orderId, CancellationToken ct)
    {
        var result = await _orders.CancelOrderAsync(CurrentUserId, orderId, ct);
        return result.IsSuccess ? Ok() : StatusCode(result.StatusCode, new { error = result.Error });
    }

    /// <summary>Get open orders</summary>
    [HttpGet("open")]
    public async Task<IActionResult> GetOpenOrders(CancellationToken ct)
    {
        var result = await _orders.GetOpenOrdersAsync(CurrentUserId, ct);
        return Ok(result.Data);
    }

    /// <summary>Get order history</summary>
    [HttpGet("history")]
    public async Task<IActionResult> GetHistory([FromQuery] int page = 1, [FromQuery] int pageSize = 50, CancellationToken ct = default)
    {
        var result = await _orders.GetOrderHistoryAsync(CurrentUserId, page, pageSize, ct);
        return Ok(result.Data);
    }

    /// <summary>Get trade history</summary>
    [HttpGet("trades")]
    public async Task<IActionResult> GetTrades([FromQuery] int page = 1, [FromQuery] int pageSize = 50, CancellationToken ct = default)
    {
        var result = await _orders.GetTradeHistoryAsync(CurrentUserId, page, pageSize, ct);
        return Ok(result.Data);
    }

    /// <summary>Export trades to CSV</summary>
    [HttpGet("trades/export")]
    public async Task<IActionResult> ExportTrades(CancellationToken ct)
    {
        var result = await _orders.ExportTradesToCsvAsync(CurrentUserId, ct);
        return File(result.Data!, "text/csv", $"trades_{DateTime.UtcNow:yyyyMMdd}.csv");
    }
}
