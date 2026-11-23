export type MarketMode = 'spot' | 'futures';
export type OrderSide = 'Buy' | 'Sell';
export type OrderType = 'Market' | 'Limit';
export type Direction = 'Long' | 'Short';

export interface User {
  id: string;
  email: string;
  username: string;
  isEmailVerified: boolean;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  user: User;
}

export interface TradingPair {
  id: string;
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  precisionPrice: number;
  precisionQty: number;
  minQty: number;
  minNotional: number;
  maxLeverage: number;
  isSpotActive: boolean;
  isFuturesActive: boolean;
}

export interface Ticker {
  symbol: string;
  lastPrice: number;
  priceChangePercent: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  quoteVolume24h: number;
  bidPrice: number;
  askPrice: number;
}

export interface Kline {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OrderBookLevel {
  price: number;
  quantity: number;
}

export interface OrderBook {
  symbol: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  lastPrice: number;
}

export interface MarketTrade {
  symbol: string;
  price: number;
  quantity: number;
  side: 'Buy' | 'Sell';
  time: number;
}

export interface Order {
  id: string;
  symbol: string;
  orderType: string;
  marketType: string;
  side: string;
  direction?: string;
  status: string;
  price?: number;
  quantity: number;
  filledQuantity: number;
  avgFillPrice?: number;
  leverage?: number;
  takeProfit?: number;
  stopLoss?: number;
  commission: number;
  createdAt: string;
  filledAt?: string;
}

export interface FuturesPosition {
  id: string;
  symbol: string;
  direction: 'Long' | 'Short';
  status: string;
  leverage: number;
  entryPrice: number;
  quantity: number;
  initialMargin: number;
  liquidationPrice: number;
  takeProfit?: number;
  stopLoss?: number;
  commission: number;
  unrealizedPnl: number;
  roePercent: number;
  markPrice: number;
  openedAt: string;
}

export interface Trade {
  id: string;
  symbol: string;
  marketType: string;
  side: string;
  direction?: string;
  price: number;
  quantity: number;
  total: number;
  commission: number;
  realizedPnl?: number;
  createdAt: string;
}

export interface Wallet {
  id: string;
  walletType: 'Spot' | 'Futures';
  assetSymbol: string;
  assetName: string;
  availableBalance: number;
  lockedBalance: number;
  totalBalance: number;
  usdtValue: number;
}

export interface CryptoAddress {
  id: string;
  assetSymbol: string;
  network: string;
  address: string;
}

export interface Transfer {
  id: string;
  txHash: string;
  transferType: string;
  assetSymbol: string;
  amount: number;
  status: string;
  fromAddress?: string;
  toAddress?: string;
  createdAt: string;
}

export interface PortfolioAnalytics {
  totalValueUsdt: number;
  allocations: {
    symbol: string;
    valueUsdt: number;
    percentage: number;
  }[];
  totalRealizedPnl: number;
  winRate: number;
  totalTrades: number;
  winTrades: number;
  lossTrades: number;
  bestTrade: number;
  worstTrade: number;
  totalCommissions: number;
  equityCurve: {
    date: string;
    equityUsdt: number;
  }[];
}
