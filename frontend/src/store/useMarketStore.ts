import { create } from 'zustand';
import { TradingPair, Ticker, OrderBook, MarketTrade, Kline } from '../types';
import { endpoints } from '../api/client';
import { signalRService } from '../api/signalr';

interface MarketState {
  pairs: TradingPair[];
  tickers: Record<string, Ticker>;
  selectedSymbol: string;
  orderBook: OrderBook | null;
  marketTrades: MarketTrade[];
  klines: Kline[];
  klineInterval: string;
  favorites: string[];
  isLoadingPairs: boolean;

  fetchPairs: () => Promise<void>;
  fetchTickers: () => Promise<void>;
  setSelectedSymbol: (symbol: string) => Promise<void>;
  setKlineInterval: (interval: string) => Promise<void>;
  fetchKlines: (symbol: string, interval?: string) => Promise<void>;
  fetchOrderBook: (symbol: string) => Promise<void>;
  fetchTrades: (symbol: string) => Promise<void>;
  toggleFavorite: (symbol: string) => void;
  updateTickerPrice: (symbol: string, price: number, changePercent: number) => void;
  addMarketTrade: (trade: MarketTrade) => void;
}

export const useMarketStore = create<MarketState>((set, get) => ({
  pairs: [],
  tickers: {},
  selectedSymbol: 'BTCUSDT',
  orderBook: null,
  marketTrades: [],
  klines: [],
  klineInterval: '1h',
  favorites: JSON.parse(localStorage.getItem('fav_pairs') || '["BTCUSDT", "ETHUSDT", "SOLUSDT"]'),
  isLoadingPairs: false,

  fetchPairs: async () => {
    set({ isLoadingPairs: true });
    try {
      const { data } = await endpoints.getPairs();
      set({ pairs: data });
    } catch (err) {
      console.error('Failed to load pairs', err);
    } finally {
      set({ isLoadingPairs: false });
    }
  },

  fetchTickers: async () => {
    try {
      const { data } = await endpoints.getTickers();
      const tickerMap: Record<string, Ticker> = {};
      data.forEach((t) => {
        tickerMap[t.symbol] = t;
      });
      set({ tickers: tickerMap });
    } catch (err) {
      console.error('Failed to load tickers', err);
    }
  },

  setSelectedSymbol: async (symbol: string) => {
    set({ selectedSymbol: symbol });
    await signalRService.subscribeMarket(symbol);
    get().fetchKlines(symbol, get().klineInterval);
    get().fetchOrderBook(symbol);
    get().fetchTrades(symbol);
  },

  setKlineInterval: async (interval: string) => {
    set({ klineInterval: interval });
    await get().fetchKlines(get().selectedSymbol, interval);
  },

  fetchKlines: async (symbol: string, interval = '1h') => {
    try {
      const { data } = await endpoints.getKlines(symbol, interval, 300);
      set({ klines: data });
    } catch (err) {
      console.error('Failed to load klines', err);
    }
  },

  fetchOrderBook: async (symbol: string) => {
    try {
      const { data } = await endpoints.getOrderBook(symbol);
      set({ orderBook: data });
    } catch (err) {
      console.error('Failed to load orderbook', err);
    }
  },

  fetchTrades: async (symbol: string) => {
    try {
      const { data } = await endpoints.getTrades(symbol, 50);
      set({ marketTrades: data });
    } catch (err) {
      console.error('Failed to load trades', err);
    }
  },

  toggleFavorite: (symbol: string) => {
    const current = get().favorites;
    const next = current.includes(symbol)
      ? current.filter((s) => s !== symbol)
      : [...current, symbol];
    localStorage.setItem('fav_pairs', JSON.stringify(next));
    set({ favorites: next });
  },

  updateTickerPrice: (symbol: string, price: number, changePercent: number) => {
    const current = get().tickers[symbol];
    if (current) {
      set({
        tickers: {
          ...get().tickers,
          [symbol]: {
            ...current,
            lastPrice: price,
            priceChangePercent: changePercent,
          },
        },
      });
    }
  },

  addMarketTrade: (trade: MarketTrade) => {
    set((state) => ({
      marketTrades: [trade, ...state.marketTrades.slice(0, 49)],
    }));
  },
}));
