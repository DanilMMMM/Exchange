import React, { useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useTradeStore } from '../../store/useTradeStore';
import { X, Lock, Mail, User as UserIcon } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { login, register } = useAuthStore();
  const { showToast, fetchWallets } = useTradeStore();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
        showToast('Successfully logged in!', 'success');
      } else {
        await register(email, username, password);
        showToast('Account created with $25,000 USDT Demo Deposit!', 'success');
      }
      await fetchWallets();
      onClose();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Authentication failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-bg-card border border-border rounded-xl w-full max-w-md p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-text-muted hover:text-text-primary"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Tab switcher */}
        <div className="flex bg-bg-panel rounded p-1 mb-6 border border-border">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`flex-1 py-1.5 rounded text-xs font-semibold transition-colors ${
              mode === 'login'
                ? 'bg-bg-card text-text-primary shadow'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            className={`flex-1 py-1.5 rounded text-xs font-semibold transition-colors ${
              mode === 'register'
                ? 'bg-bg-card text-text-primary shadow'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            Create Account
          </button>
        </div>

        <div className="mb-6">
          <h2 className="text-xl font-bold text-text-primary mb-1">
            {mode === 'login' ? 'Welcome Back' : 'Get $25,000 USDT Demo Balance'}
          </h2>
          <p className="text-xs text-text-muted">
            {mode === 'login'
              ? 'Enter your credentials to access your trading account'
              : 'Sign up to start paper trading with real Bybit market quotes'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-text-muted absolute left-3 top-2.5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full bg-bg-panel border border-border rounded-lg pl-9 pr-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent-gold"
              />
            </div>
          </div>

          {mode === 'register' && (
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">
                Username
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-text-muted absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="trader123"
                  className="w-full bg-bg-panel border border-border rounded-lg pl-9 pr-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent-gold"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-text-muted absolute left-3 top-2.5" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-bg-panel border border-border rounded-lg pl-9 pr-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent-gold"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-accent-gold hover:bg-accent-gold-hover text-bg-primary font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 mt-2 shadow-lg shadow-accent-gold/10"
          >
            {loading ? 'Processing...' : mode === 'login' ? 'Sign In' : 'Claim $25,000 & Register'}
          </button>
        </form>
      </div>
    </div>
  );
};
