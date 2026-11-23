namespace Exchange.Domain.Enums;

public enum OrderType { Market, Limit }
public enum MarketType { Spot, Futures }
public enum OrderSide { Buy, Sell }
public enum Direction { Long, Short }
public enum OrderStatus { Open, Filled, PartiallyFilled, Cancelled, Rejected }
public enum PositionStatus { Open, Closed, Liquidated }
public enum CloseReason { Manual, TakeProfit, StopLoss, Liquidation, PartialClose }
public enum WalletType { Spot, Futures }
public enum TransferType { Internal, BetweenAccounts }
public enum TransferStatus { Pending, Completed, Failed }
