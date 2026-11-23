using Exchange.Application.DTOs.Orders;
using Exchange.Application.Common;

namespace Exchange.Application.Interfaces;

public interface IOrderService
{
    Task<Result<OrderDto>> PlaceOrderAsync(Guid userId, PlaceOrderRequest request, CancellationToken ct = default);
    Task<Result> CancelOrderAsync(Guid userId, Guid orderId, CancellationToken ct = default);
    Task<Result<List<OrderDto>>> GetOpenOrdersAsync(Guid userId, CancellationToken ct = default);
    Task<Result<List<OrderDto>>> GetOrderHistoryAsync(Guid userId, int page = 1, int pageSize = 50, CancellationToken ct = default);
    Task<Result<List<TradeDto>>> GetTradeHistoryAsync(Guid userId, int page = 1, int pageSize = 50, CancellationToken ct = default);
    Task<Result<byte[]>> ExportTradesToCsvAsync(Guid userId, CancellationToken ct = default);
}

public interface IFuturesService
{
    Task<Result<FuturesPositionDto>> OpenPositionAsync(Guid userId, PlaceOrderRequest request, CancellationToken ct = default);
    Task<Result> ClosePositionAsync(Guid userId, ClosePositionRequest request, CancellationToken ct = default);
    Task<Result> EditTpSlAsync(Guid userId, EditPositionTpSlRequest request, CancellationToken ct = default);
    Task<Result<List<FuturesPositionDto>>> GetOpenPositionsAsync(Guid userId, CancellationToken ct = default);
    Task<Result<List<FuturesPositionDto>>> GetPositionHistoryAsync(Guid userId, CancellationToken ct = default);
}
