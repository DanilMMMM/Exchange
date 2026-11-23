using Exchange.Domain.Enums;

namespace Exchange.Application.DTOs.Orders;

// ---- Requests ----
public record PlaceOrderRequest(
    string Symbol,
    OrderType OrderType,
    MarketType MarketType,
    OrderSide Side,
    decimal Quantity,
    decimal? Price,           // null for Market
    Direction? Direction,     // Futures only
    int? Leverage,            // Futures only
    decimal? TakeProfit,
    decimal? StopLoss,
    string? ClientOrderId);

public record CancelOrderRequest(Guid OrderId);

public record EditPositionTpSlRequest(
    Guid PositionId,
    decimal? TakeProfit,
    decimal? StopLoss);

public record ClosePositionRequest(
    Guid PositionId,
    decimal? Quantity);    // null = close full

// ---- Responses ----
public record OrderDto(
    Guid Id,
    string Symbol,
    string OrderType,
    string MarketType,
    string Side,
    string? Direction,
    string Status,
    decimal? Price,
    decimal Quantity,
    decimal FilledQuantity,
    decimal? AvgFillPrice,
    int? Leverage,
    decimal? TakeProfit,
    decimal? StopLoss,
    decimal Commission,
    DateTime CreatedAt,
    DateTime? FilledAt);

public record TradeDto(
    Guid Id,
    string Symbol,
    string MarketType,
    string Side,
    string? Direction,
    decimal Price,
    decimal Quantity,
    decimal Total,
    decimal Commission,
    decimal? RealizedPnl,
    DateTime CreatedAt);

public record FuturesPositionDto(
    Guid Id,
    string Symbol,
    string Direction,
    string Status,
    int Leverage,
    decimal EntryPrice,
    decimal Quantity,
    decimal InitialMargin,
    decimal LiquidationPrice,
    decimal? TakeProfit,
    decimal? StopLoss,
    decimal Commission,
    decimal UnrealizedPnl,
    decimal RoePercent,
    decimal MarkPrice,
    DateTime OpenedAt);
