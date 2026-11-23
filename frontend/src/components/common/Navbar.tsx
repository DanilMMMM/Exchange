import React, { useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useTradeStore } from '../../store/useTradeStore';
import { formatPrice } from '../../utils/formatters';
import { AuthModal } from './AuthModal';
import { endpoints } from '../../api/client';
import {
  TrendingUp,
  Wallet as WalletIcon,
  PieChart,
  BarChart3,
  Layers,
  PlusCircle,
  LogOut,
  User as UserIcon,
  Wifi,
} from 'lucide-react';

interface NavbarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPage, onNavigate }) => {
  const { user, isAuthenticated, logout } = useAuthStore();
  const { wallets, fetchWallets, showToast } = useTradeStore();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [isToppingUp, setIsToppingUp] = useState(false);

  // Calculate total portfolio balance in USDT
  const totalBalanceUsdt = wallets.reduce((acc, w) => acc + (w.usdtValue || 0), 0);

  const handleTopup = async () => {
    if (!isAuthenticated) {
      setAuthModalOpen(true);
      return;
    }
    setIsToppingUp(true);
    try {
      await endpoints.addDemoBalance();
      await fetchWallets();
      showToast('+10,000 USDT Demo Balance Added!', 'success');
    } catch {
      showToast('Failed to top-up demo balance', 'error');
    } finally {
      setIsToppingUp(false);
    }
  };

  const navItems = [
    { id: 'spot', label: 'Spot', icon: <TrendingUp className="w-3.5 h-3.5" /> },
    { id: 'futures', label: 'Futures', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'markets', label: 'Markets', icon: <BarChart3 className="w-3.5 h-3.5" /> },
    { id: 'wallet', label: 'Wallet', icon: <WalletIcon className="w-3.5 h-3.5" /> },
    { id: 'analytics', label: 'Analytics', icon: <PieChart className="w-3.5 h-3.5" /> },
  ];

  return (
    <>
      <header className="h-12 bg-bg-card border-b border-border flex items-center justify-between px-4 select-none z-40 text-xs">
        {/* Brand & Main Nav */}
        <div className="flex items-center space-x-6">
          <div
            onClick={() => onNavigate('spot')}
            className="flex items-center space-x-2 cursor-pointer group"
          >
            <div className="w-6 h-6 rounded bg-gradient-to-tr from-accent-gold to-yellow-200 flex items-center justify-center shadow-lg shadow-accent-gold/20">
              <span className="font-black text-bg-primary text-xs">A</span>
            </div>
            <span className="font-extrabold text-sm tracking-tight text-text-primary group-hover:text-accent-gold transition-colors">
              APEX<span className="text-accent-gold">TRADE</span>
            </span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-accent-gold/15 text-accent-gold border border-accent-gold/30 uppercase tracking-wider">
              PAPER
            </span>
          </div>

          <nav className="flex items-center space-x-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
                  currentPage === item.id
                    ? 'text-accent-gold bg-bg-panel border border-border shadow-sm'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Right side controls */}
        <div className="flex items-center space-x-4">
          {/* Bybit Live Feed Status */}
          <div className="hidden lg:flex items-center space-x-1.5 text-[10px] text-text-muted bg-bg-panel px-2 py-1 rounded border border-border">
            <span className="w-1.5 h-1.5 rounded-full bg-trade-buy animate-pulse" />
            <Wifi className="w-3 h-3 text-text-muted" />
            <span>Bybit Live v5</span>
          </div>

          {/* Quick Demo Deposit */}
          {isAuthenticated && (
            <div className="flex items-center space-x-2">
              <div className="hidden sm:flex flex-col text-right tabular-nums">
                <span className="text-[9px] text-text-muted uppercase">Demo Equity</span>
                <span className="text-xs font-bold text-text-primary">
                  ${formatPrice(totalBalanceUsdt || 25000)}
                </span>
              </div>
              <button
                onClick={handleTopup}
                disabled={isToppingUp}
                className="flex items-center space-x-1 px-2.5 py-1 rounded bg-accent-gold/15 hover:bg-accent-gold/25 border border-accent-gold/40 text-accent-gold text-xs font-semibold transition-colors"
                title="Add 10,000 USDT Demo Balance"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>+10k USDT</span>
              </button>
            </div>
          )}

          {/* User Profile / Auth */}
          {isAuthenticated ? (
            <div className="flex items-center space-x-3">
              <div
                onClick={() => onNavigate('wallet')}
                className="flex items-center space-x-2 cursor-pointer bg-bg-panel hover:bg-bg-hover px-2.5 py-1 rounded border border-border transition-colors"
              >
                <UserIcon className="w-3.5 h-3.5 text-accent-gold" />
                <span className="font-semibold text-text-primary text-xs">
                  {user?.username}
                </span>
              </div>
              <button
                onClick={logout}
                className="p-1.5 rounded hover:bg-bg-hover text-text-muted hover:text-trade-sell transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAuthModalOpen(true)}
              className="px-3 py-1.5 rounded bg-accent-gold hover:bg-accent-gold-hover text-bg-primary font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-accent-gold/15"
            >
              Log In / Register
            </button>
          )}
        </div>
      </header>

      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </>
  );
};
