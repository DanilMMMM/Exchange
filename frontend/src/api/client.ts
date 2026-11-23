import axios from 'axios';
import {
  AuthResponse,
  TradingPair,
  Ticker,
  Kline,
  OrderBook,
  MarketTrade,
  Order,
  FuturesPosition,
  Trade,
  Wallet,
  CryptoAddress,
  Transfer,
  PortfolioAnalytics,
} from '../types';

const API_BASE = 'http://localhost:5000/api';

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken && !err.config._retry) {
        err.config._retry = true;
        try {
          const { data } = await axios.post<AuthResponse>(`${API_BASE}/auth/refresh`, {
            refreshToken,
          });
          localStorage.setItem('token', data.accessToken);
          localStorage.setItem('refreshToken', data.refreshToken);
          err.config.headers.Authorization = `Bearer ${data.accessToken}`;
          return api(err.config);
        } catch {
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
        }
      }
    }
    return Promise.reject(err);
  }
);

export const endpoints = {
  // Auth
  register: (body: any) => api.post<AuthResponse>('/auth/register', body),
  login: (body: any) => api.post<AuthResponse>('/auth/login', body),
  refreshToken: (body: any) => api.post<AuthResponse>('/auth/refresh', body),
  revokeToken: (body: any) => api.post('/auth/revoke', body),

  // Market
  getPairs: () => api.get<TradingPair[]>('/market/pairs'),
  getTickers: () => api.get<Ticker[]>('/market/tickers'),
  getTicker: (symbol: string) => api.get<Ticker>(`/market/tickers/${symbol}`),
  getKlines: (symbol: string, interval = '1h', limit = 300) =>
    api.get<Kline[]>(`/market/klines/${symbol}?interval=${interval}&limit=${limit}`),
  getOrderBook: (symbol: string) => api.get<OrderBook>(`/market/orderbook/${symbol}`),
  getTrades: (symbol: string, limit = 50) =>
    api.get<MarketTrade[]>(`/market/trades/${symbol}?limit=${limit}`),

  // Spot Orders
  placeSpotOrder: (body: any) => api.post<Order>('/orders', body),
  cancelSpotOrder: (orderId: string) => api.delete(`/orders/${orderId}`),
  getOpenOrders: () => api.get<Order[]>('/orders/open'),
  getOrderHistory: (page = 1, pageSize = 50) =>
    api.get<Order[]>(`/orders/history?page=${page}&pageSize=${pageSize}`),
  getTradeHistory: (page = 1, pageSize = 50) =>
    api.get<Trade[]>(`/orders/trades?page=${page}&pageSize=${pageSize}`),
  exportTradesCsv: () => api.get('/orders/trades/export', { responseType: 'blob' }),

  // Futures
  openPosition: (body: any) => api.post<FuturesPosition>('/futures/positions', body),
  closePosition: (body: any) => api.post('/futures/positions/close', body),
  editTpSl: (body: any) => api.patch('/futures/positions/tpsl', body),
  getOpenPositions: () => api.get<FuturesPosition[]>('/futures/positions'),
  getPositionHistory: () => api.get<FuturesPosition[]>('/futures/positions/history'),

  // Wallet
  getWallets: () => api.get<Wallet[]>('/wallet'),
  getAddresses: (assetSymbol: string) => api.get<CryptoAddress[]>(`/wallet/addresses/${assetSymbol}`),
  internalTransfer: (body: any) => api.post<Transfer>('/wallet/transfer/internal', body),
  betweenAccountsTransfer: (body: any) => api.post<Transfer>('/wallet/transfer/accounts', body),
  addDemoBalance: () => api.post<{ newBalance: number }>('/wallet/demo/topup'),
  getTransfers: () => api.get<Transfer[]>('/wallet/transfers'),

  // Analytics
  getPortfolioAnalytics: () => api.get<PortfolioAnalytics>('/analytics/portfolio'),
};
