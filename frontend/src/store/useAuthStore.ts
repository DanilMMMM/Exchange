import { create } from 'zustand';
import { User } from '../types';
import { endpoints } from '../api/client';
import { signalRService } from '../api/signalr';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => void;
  initAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token'),

  initAuth: () => {
    const token = localStorage.getItem('token');
    const userJson = localStorage.getItem('user');
    if (token && userJson) {
      try {
        const user = JSON.parse(userJson);
        set({ user, token, isAuthenticated: true });
        signalRService.connect().then(() => {
          signalRService.subscribeUser(user.id);
        });
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
  },

  login: async (email, password) => {
    const { data } = await endpoints.login({ email, password });
    localStorage.setItem('token', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem('user', JSON.stringify(data.user));
    set({ user: data.user, token: data.accessToken, isAuthenticated: true });
    await signalRService.connect();
    await signalRService.subscribeUser(data.user.id);
  },

  register: async (email, username, password) => {
    const { data } = await endpoints.register({ email, username, password });
    localStorage.setItem('token', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem('user', JSON.stringify(data.user));
    set({ user: data.user, token: data.accessToken, isAuthenticated: true });
    await signalRService.connect();
    await signalRService.subscribeUser(data.user.id);
  },

  logout: () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      endpoints.revokeToken({ refreshToken }).catch(() => {});
    }
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    set({ user: null, token: null, isAuthenticated: false });
  },
}));
