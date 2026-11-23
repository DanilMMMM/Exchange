import { create } from 'zustand';
import { Order, FuturesPosition, Trade, Wallet } from '../types';
import { endpoints } from '../api/client';

interface TradeState {
  wallets: Wallet[];
  openOrders: Order[];
  orderHistory: Order[];
  tradeHistory: Trade[];
  positions: FuturesPosition[];
  positionHistory: FuturesPosition[];
  toastMessage: { text: string; type: 'success' | 'error' | 'warning' | 'info' } | null;

  fetchWallets: () => Promise<void>;
  fetchOpenOrders: () => Promise<void>;
  fetchOrderHistory: () => Promise<void>;
  fetchTradeHistory: () => Promise<void>;
  fetchPositions: () => Promise<void>;
  fetchPositionHistory: () => Promise<void>;
  cancelOrder: (orderId: string) => Promise<void>;
  closePosition: (positionId: string, quantity?: number) => Promise<void>;
  editTpSl: (positionId: string, tp?: number, sl?: number) => Promise<void>;
  showToast: (text: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  clearToast: () => void;
}

export const useTradeStore = create<TradeState>((set, get) => ({
  wallets: [],
  openOrders: [],
  orderHistory: [],
  tradeHistory: [],
  positions: [],
  positionHistory: [],
  toastMessage: null,

  fetchWallets: async () => {
    try {
      const { data } = await endpoints.getWallets();
      set({ wallets: data });
    } catch {}
  },

  fetchOpenOrders: async () => {
    try {
      const { data } = await endpoints.getOpenOrders();
      set({ openOrders: data });
    } catch {}
  },

  fetchOrderHistory: async () => {
    try {
      const { data } = await endpoints.getOrderHistory();
      set({ orderHistory: data });
    } catch {}
  },

  fetchTradeHistory: async () => {
    try {
      const { data } = await endpoints.getTradeHistory();
      set({ tradeHistory: data });
    } catch {}
  },

  fetchPositions: async () => {
    try {
      const { data } = await endpoints.getOpenPositions();
      set({ positions: data });
    } catch {}
  },

  fetchPositionHistory: async () => {
    try {
      const { data } = await endpoints.getPositionHistory();
      set({ positionHistory: data });
    } catch {}
  },

  cancelOrder: async (orderId: string) => {
    try {
      await endpoints.cancelSpotOrder(orderId);
      get().showToast('Order cancelled', 'info');
      await get().fetchOpenOrders();
      await get().fetchWallets();
    } catch (err: any) {
      get().showToast(err.response?.data?.error || 'Failed to cancel order', 'error');
    }
  },

  closePosition: async (positionId: string, quantity?: number) => {
    try {
      await endpoints.closePosition({ positionId, quantity });
      get().showToast('Position closed', 'success');
      await get().fetchPositions();
      await get().fetchWallets();
    } catch (err: any) {
      get().showToast(err.response?.data?.error || 'Failed to close position', 'error');
    }
  },

  editTpSl: async (positionId: string, tp?: number, sl?: number) => {
    try {
      await endpoints.editTpSl({ positionId, takeProfit: tp, stopLoss: sl });
      get().showToast('TP / SL updated', 'success');
      await get().fetchPositions();
    } catch (err: any) {
      get().showToast(err.response?.data?.error || 'Failed to update TP/SL', 'error');
    }
  },

  showToast: (text: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    set({ toastMessage: { text, type } });
    setTimeout(() => {
      if (get().toastMessage?.text === text) {
        set({ toastMessage: null });
      }
    }, 4500);
  },

  clearToast: () => set({ toastMessage: null }),
}));
