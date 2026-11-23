import React, { useState, useEffect } from 'react';
import { useMarketStore } from '../../store/useMarketStore';
import { useTradeStore } from '../../store/useTradeStore';
import { useAuthStore } from '../../store/useAuthStore';
import { endpoints } from '../../api/client';
import { formatPrice } from '../../utils/formatters';

interface OrderFormProps {
  mode: 'spot' | 'futures';
  selectedPrice?: number | null;
}

export const OrderForm: React.FC<OrderFormProps> = ({ mode, selectedPrice }) => {
  const { selectedSymbol, tickers, pairs } = useMarketStore();
  const { wallets, fetchWallets, fetchOpenOrders, fetchPositions, showToast } =
    useTradeStore();
  const { isAuthenticated } = useAuthStore();

  const [orderType, setOrderType] = useState<'Market' | 'Limit'>('Market');
  const [side, setSide] = useState<'Buy' | 'Sell'>('Buy');
  const [direction, setDirection] = useState<'Long' | 'Short'>('Long');
  const [price, setPrice] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('');
  const [leverage, setLeverage] = useState<number>(10);
  const [takeProfit, setTakeProfit] = useState<string>('');
  const [stopLoss, setStopLoss] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const ticker = tickers[selectedSymbol];
  const currentPrice = ticker?.lastPrice ?? 0;
  const currentPair = pairs.find((p) => p.symbol === selectedSymbol);

  // Set selected price when user clicks order book
  useEffect(() => {
    if (selectedPrice) {
      setPrice(selectedPrice.toString());
      setOrderType('Limit');
    }
  }, [selectedPrice]);

  // Set default price on symbol change
  useEffect(() => {
    if (currentPrice > 0 && !price) {
      setPrice(currentPrice.toString());
    }
  }, [currentPrice]);

  // Balances
  const usdtWallet = wallets.find(
    (w) =>
      w.assetSymbol === 'USDT' &&
      w.walletType === (mode === 'spot' ? 'Spot' : 'Futures')
  );
  const baseWallet = wallets.find(
    (w) =>
      w.assetSymbol === currentPair?.baseAsset &&
      w.walletType === 'Spot'
  );

  const availableUsdt = usdtWallet?.availableBalance ?? 0;
  const availableBase = baseWallet?.availableBalance ?? 0;

  // Financial calculations
  const effPrice = orderType === 'Market' ? currentPrice : Number(price) || currentPrice;
  const numQty = Number(quantity) || 0;
  const notional = effPrice * numQty;

  const initialMargin = mode === 'futures' ? (leverage > 0 ? notional / leverage : 0) : 0;
  const feeRate = mode === 'futures' ? 0.0005 : 0.001;
  const fee = notional * feeRate;

  // Liquidation price estimation (Isolated Margin)
  const estLiqPrice =
    mode === 'futures' && effPrice > 0 && leverage > 0
      ? direction === 'Long'
        ? effPrice * (1 - 1 / leverage + 0.005)
        : effPrice * (1 + 1 / leverage - 0.005)
      : 0;

  const handlePercentageClick = (pct: number) => {
    if (mode === 'spot') {
      if (side === 'Buy') {
        const maxSpend = availableUsdt * (pct / 100);
        if (effPrice > 0) {
          const qty = maxSpend / effPrice;
          setQuantity(qty.toFixed(currentPair?.precisionQty || 4));
        }
      } else {
        const qty = availableBase * (pct / 100);
        setQuantity(qty.toFixed(currentPair?.precisionQty || 4));
      }
    } else {
      // Futures
      const maxMargin = availableUsdt * (pct / 100);
      const targetNotional = maxMargin * leverage;
      if (effPrice > 0) {
        const qty = targetNotional / effPrice;
        setQuantity(qty.toFixed(currentPair?.precisionQty || 4));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      showToast('Please login to start paper trading', 'warning');
      return;
    }

    if (numQty <= 0) {
      showToast('Quantity must be greater than 0', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === 'spot') {
        await endpoints.placeSpotOrder({
          symbol: selectedSymbol,
          orderType,
          marketType: 'Spot',
          side,
          quantity: numQty,
          price: orderType === 'Limit' ? Number(price) : null,
          takeProfit: takeProfit ? Number(takeProfit) : null,
          stopLoss: stopLoss ? Number(stopLoss) : null,
        });
        showToast(`Spot ${orderType} order placed successfully!`, 'success');
        fetchOpenOrders();
      } else {
        await endpoints.openPosition({
          symbol: selectedSymbol,
          orderType,
          marketType: 'Futures',
          side: direction === 'Long' ? 'Buy' : 'Sell',
          direction,
          leverage,
          quantity: numQty,
          price: orderType === 'Limit' ? Number(price) : null,
          takeProfit: takeProfit ? Number(takeProfit) : null,
          stopLoss: stopLoss ? Number(stopLoss) : null,
        });
        showToast(
          `Futures ${direction} ${leverage}x position opened successfully!`,
          'success'
        );
        fetchPositions();
      }
      setQuantity('');
      fetchWallets();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to place order', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-bg-card p-3 select-none text-xs">
      {/* Mode / Type Toggle */}
      <div className="flex bg-bg-panel rounded p-0.5 mb-3 border border-border">
        <button
          type="button"
          onClick={() => setOrderType('Market')}
          className={`flex-1 py-1 rounded text-xs font-semibold transition-colors ${
            orderType === 'Market'
              ? 'bg-bg-card text-text-primary shadow'
              : 'text-text-muted hover:text-text-primary'
          }`}
        >
          Market
        </button>
        <button
          type="button"
          onClick={() => setOrderType('Limit')}
          className={`flex-1 py-1 rounded text-xs font-semibold transition-colors ${
            orderType === 'Limit'
              ? 'bg-bg-card text-text-primary shadow'
              : 'text-text-muted hover:text-text-primary'
          }`}
        >
          Limit
        </button>
      </div>

      {/* Side Selector */}
      {mode === 'spot' ? (
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            type="button"
            onClick={() => setSide('Buy')}
            className={`py-2 rounded font-bold uppercase tracking-wider transition-colors ${
              side === 'Buy'
                ? 'bg-trade-buy text-white'
                : 'bg-bg-panel text-text-muted hover:text-text-primary border border-border'
            }`}
          >
            Buy {currentPair?.baseAsset}
          </button>
          <button
            type="button"
            onClick={() => setSide('Sell')}
            className={`py-2 rounded font-bold uppercase tracking-wider transition-colors ${
              side === 'Sell'
                ? 'bg-trade-sell text-white'
                : 'bg-bg-panel text-text-muted hover:text-text-primary border border-border'
            }`}
          >
            Sell {currentPair?.baseAsset}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            type="button"
            onClick={() => setDirection('Long')}
            className={`py-2 rounded font-bold uppercase tracking-wider transition-colors ${
              direction === 'Long'
                ? 'bg-trade-buy text-white'
                : 'bg-bg-panel text-text-muted hover:text-text-primary border border-border'
            }`}
          >
            Open Long
          </button>
          <button
            type="button"
            onClick={() => setDirection('Short')}
            className={`py-2 rounded font-bold uppercase tracking-wider transition-colors ${
              direction === 'Short'
                ? 'bg-trade-sell text-white'
                : 'bg-bg-panel text-text-muted hover:text-text-primary border border-border'
            }`}
          >
            Open Short
          </button>
        </div>
      )}

      {/* Leverage Selector (Futures only) */}
      {mode === 'futures' && (
        <div className="mb-3 p-2 bg-bg-panel rounded border border-border">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[11px] text-text-muted font-medium">Leverage</span>
            <span className="text-xs font-bold text-accent-gold tabular-nums">
              {leverage}x
            </span>
          </div>
          <div className="flex items-center space-x-1.5 mb-1.5">
            {[1, 5, 10, 20, 50].map((lev) => (
              <button
                key={lev}
                type="button"
                onClick={() => setLeverage(lev)}
                className={`flex-1 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                  leverage === lev
                    ? 'bg-accent-gold text-bg-primary font-bold'
                    : 'bg-bg-card text-text-secondary hover:text-text-primary border border-border'
                }`}
              >
                {lev}x
              </button>
            ))}
          </div>
          <input
            type="range"
            min="1"
            max="50"
            value={leverage}
            onChange={(e) => setLeverage(Number(e.target.value))}
            className="w-full accent-accent-gold cursor-pointer"
          />
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col justify-between">
        <div className="space-y-2.5">
          {/* Price Input (if Limit) */}
          {orderType === 'Limit' && (
            <div>
              <label className="block text-[10px] text-text-muted mb-1 font-medium">
                Order Price (USDT)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-bg-panel border border-border rounded px-2.5 py-1.5 text-text-primary tabular-nums focus:outline-none focus:border-accent-gold/60"
                  required
                />
                <span className="absolute right-2.5 top-1.5 text-text-muted text-[10px]">
                  USDT
                </span>
              </div>
            </div>
          )}

          {/* Quantity Input */}
          <div>
            <div className="flex justify-between text-[10px] text-text-muted mb-1 font-medium">
              <span>Order Size</span>
              <span>{currentPair?.baseAsset}</span>
            </div>
            <div className="relative">
              <input
                type="number"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0.00"
                className="w-full bg-bg-panel border border-border rounded px-2.5 py-1.5 text-text-primary tabular-nums focus:outline-none focus:border-accent-gold/60"
                required
              />
              <span className="absolute right-2.5 top-1.5 text-text-muted text-[10px]">
                {currentPair?.baseAsset}
              </span>
            </div>
          </div>

          {/* Quick % buttons */}
          <div className="grid grid-cols-4 gap-1">
            {[25, 50, 75, 100].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => handlePercentageClick(pct)}
                className="py-1 rounded bg-bg-panel hover:bg-bg-hover text-[10px] font-medium text-text-secondary border border-border transition-colors"
              >
                {pct}%
              </button>
            ))}
          </div>

          {/* TP / SL options (Futures only) */}
          {mode === 'futures' && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <label className="block text-[10px] text-text-muted mb-1">
                  Take Profit
                </label>
                <input
                  type="number"
                  step="any"
                  value={takeProfit}
                  onChange={(e) => setTakeProfit(e.target.value)}
                  placeholder="TP Price"
                  className="w-full bg-bg-panel border border-border rounded px-2 py-1 text-text-primary tabular-nums text-[11px] focus:outline-none focus:border-accent-gold/60"
                />
              </div>
              <div>
                <label className="block text-[10px] text-text-muted mb-1">
                  Stop Loss
                </label>
                <input
                  type="number"
                  step="any"
                  value={stopLoss}
                  onChange={(e) => setStopLoss(e.target.value)}
                  placeholder="SL Price"
                  className="w-full bg-bg-panel border border-border rounded px-2 py-1 text-text-primary tabular-nums text-[11px] focus:outline-none focus:border-accent-gold/60"
                />
              </div>
            </div>
          )}

          {/* Financial Breakdown */}
          <div className="pt-2 border-t border-border space-y-1 text-[11px] tabular-nums text-text-muted">
            <div className="flex justify-between">
              <span>Available</span>
              <span className="text-text-primary font-medium">
                {mode === 'spot' && side === 'Sell'
                  ? `${formatPrice(availableBase, 4)} ${currentPair?.baseAsset}`
                  : `${formatPrice(availableUsdt)} USDT`}
              </span>
            </div>
            {mode === 'futures' && (
              <>
                <div className="flex justify-between">
                  <span>Req. Margin</span>
                  <span className="text-text-primary font-medium">
                    {formatPrice(initialMargin)} USDT
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Est. Liq Price</span>
                  <span className="text-trade-sell font-medium">
                    ${formatPrice(estLiqPrice)}
                  </span>
                </div>
              </>
            )}
            <div className="flex justify-between">
              <span>Est. Fee ({mode === 'futures' ? '0.05%' : '0.1%'})</span>
              <span className="text-text-primary">{formatPrice(fee, 4)} USDT</span>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-2.5 rounded font-bold uppercase tracking-wider text-white shadow-lg transition-all ${
              mode === 'spot'
                ? side === 'Buy'
                  ? 'bg-trade-buy hover:bg-trade-buy-hover shadow-trade-buy/10'
                  : 'bg-trade-sell hover:bg-trade-sell-hover shadow-trade-sell/10'
                : direction === 'Long'
                ? 'bg-trade-buy hover:bg-trade-buy-hover shadow-trade-buy/10'
                : 'bg-trade-sell hover:bg-trade-sell-hover shadow-trade-sell/10'
            } disabled:opacity-50`}
          >
            {isSubmitting
              ? 'Executing...'
              : mode === 'spot'
              ? `${side} ${currentPair?.baseAsset}`
              : `Open ${direction} ${leverage}x`}
          </button>
        </div>
      </form>
    </div>
  );
};
