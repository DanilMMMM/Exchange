import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useTradeStore } from '../../store/useTradeStore';
import { X, Lock, Mail, User as UserIcon } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: 'login' | 'register';
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode = 'login',
  onClose,
}) => {
  const { login, register } = useAuthStore();
  const { showToast, fetchWallets } = useTradeStore();

  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
        showToast('Успешный вход в систему!', 'success');
      } else {
        await register(email, username, password);
        showToast('Аккаунт создан! Начислено 25 000 USDT демо-баланса!', 'success');
      }
      await fetchWallets();
      onClose();
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || '';
      if (mode === 'login' && errorMsg.includes('Invalid credentials')) {
        showToast(
          'Неверный логин/пароль. Если вы ещё не создали аккаунт — перейдите во вкладку "Регистрация"!',
          'warning'
        );
      } else {
        showToast(errorMsg || 'Ошибка авторизации. Проверьте данные.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-50 p-4 select-none">
      <div className="bg-bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Tab switcher - Extra clear and prominent */}
        <div className="flex bg-bg-panel rounded-xl p-1.5 mb-6 border border-border">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
              mode === 'login'
                ? 'bg-accent-gold text-bg-primary shadow-lg shadow-accent-gold/20'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
            }`}
          >
            Войти в аккаунт
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
              mode === 'register'
                ? 'bg-accent-gold text-bg-primary shadow-lg shadow-accent-gold/20'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
            }`}
          >
            Регистрация (+25k$)
          </button>
        </div>

        <div className="mb-6">
          <h2 className="text-xl font-bold text-text-primary mb-1">
            {mode === 'login' ? 'Вход в терминал' : 'Создание аккаунта'}
          </h2>
          <p className="text-xs text-text-muted">
            {mode === 'login'
              ? 'Введите email (или username) и пароль для входа'
              : 'Создайте аккаунт и получите виртуальный депозит 25,000 USDT'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5">
              {mode === 'login' ? 'Email или Username' : 'Email адрес'}
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-text-muted absolute left-3 top-2.5" />
              <input
                type={mode === 'login' ? 'text' : 'email'}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={mode === 'login' ? 'name@example.com или trader1' : 'name@example.com'}
                className="w-full bg-bg-panel border border-border rounded-lg pl-9 pr-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent-gold"
              />
            </div>
          </div>

          {mode === 'register' && (
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">
                Имя пользователя (Username)
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
              Пароль
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
            className="w-full py-2.5 rounded-lg bg-accent-gold hover:bg-accent-gold-hover text-bg-primary font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 mt-2 shadow-lg shadow-accent-gold/20"
          >
            {loading
              ? 'Обработка...'
              : mode === 'login'
              ? 'Войти'
              : 'Создать аккаунт и получить 25 000 USDT'}
          </button>
        </form>

        {/* Footer switch prompt */}
        <div className="mt-5 text-center text-xs text-text-muted pt-3 border-t border-border">
          {mode === 'login' ? (
            <span>
              Ещё нет аккаунта?{' '}
              <button
                type="button"
                onClick={() => setMode('register')}
                className="text-accent-gold font-semibold hover:underline"
              >
                Зарегистрироваться
              </button>
            </span>
          ) : (
            <span>
              Уже зарегистрированы?{' '}
              <button
                type="button"
                onClick={() => setMode('login')}
                className="text-accent-gold font-semibold hover:underline"
              >
                Войти в аккаунт
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
