import React, { useState, useMemo } from 'react';
import { useMarketStore } from '../../store/useMarketStore';
import { formatPrice, formatQty } from '../../utils/formatters';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface OrderBookProps {
  onSelectPrice?: (price: number) => void;
}

export const OrderBook: React.FC<OrderBookProps> = ({ onSelectPrice }) => {
  const { orderBook, tickers, selectedSymbol } = useMarketStore();
  const ticker = tickers[selectedSymbol];

  const [viewMode, setViewMode] = useState<'both' | 'bids' | 'asks'>('both');

  const bids = orderBook?.bids || [];
  const asks = orderBook?.asks || [];

  // Determine row count based on viewMode
  const rowLimit = viewMode === 'both' ? 16 : 32;

  const displayAsks = useMemo(() => {
    if (viewMode === 'bids') return [];
    return asks.slice(0, rowLimit).reverse();
  }, [asks, viewMode, rowLimit]);

  const displayBids = useMemo(() => {
    if (viewMode === 'asks') return [];
    return bids.slice(0, rowLimit);
  }, [bids, viewMode, rowLimit]);

  // Compute depth volume totals for visualization bars
  const maxAskTotal = useMemo(() => {
    let sum = 0;
    displayAsks.forEach((a) => (sum += Number(a.quantity)));
    return sum || 1;
  }, [displayAsks]);

  const maxBidTotal = useMemo(() => {
    let sum = 0;
    displayBids.forEach((b) => (sum += Number(b.quantity)));
    return sum || 1;
  }, [displayBids]);

  const spread = useMemo(() => {
    if (asks.length > 0 && bids.length > 0) {
      return Math.max(0, Number(asks[0].price) - Number(bids[0].price));
    }
    return 0;
  }, [asks, bids]);

  const isPositive = (ticker?.priceChangePercent ?? 0) >= 0;

  return (
    <div className="flex flex-col h-full bg-bg-card select-none text-[11px] tabular-nums overflow-hidden">
      {/* Top Controls: View Mode switchers */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-bg-secondary text-[10px]">
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setViewMode('both')}
            title="Оба стакана (Покупки и Продажи)"
            className={`p-1 rounded transition-colors flex flex-col justify-center items-center w-5 h-5 ${
              viewMode === 'both' ? 'bg-bg-panel ring-1 ring-accent-gold' : 'hover:bg-bg-hover opacity-60'
            }`}
          >
            <span className="w-3 h-1 bg-trade-sell rounded-xs mb-0.5" />
            <span className="w-3 h-1 bg-trade-buy rounded-xs" />
          </button>
          <button
            onClick={() => setViewMode('bids')}
            title="Только покупки (Bids)"
            className={`p-1 rounded transition-colors flex flex-col justify-center items-center w-5 h-5 ${
              viewMode === 'bids' ? 'bg-bg-panel ring-1 ring-accent-gold' : 'hover:bg-bg-hover opacity-60'
            }`}
          >
            <span className="w-3 h-1.5 bg-trade-buy rounded-xs mb-0.5" />
            <span className="w-3 h-1.5 bg-trade-buy rounded-xs" />
          </button>
          <button
            onClick={() => setViewMode('asks')}
            title="Только продажи (Asks)"
            className={`p-1 rounded transition-colors flex flex-col justify-center items-center w-5 h-5 ${
              viewMode === 'asks' ? 'bg-bg-panel ring-1 ring-accent-gold' : 'hover:bg-bg-hover opacity-60'
            }`}
          >
            <span className="w-3 h-1.5 bg-trade-sell rounded-xs mb-0.5" />
            <span className="w-3 h-1.5 bg-trade-sell rounded-xs" />
          </button>
        </div>

        <div className="text-text-muted font-medium">
          Шаг: <span className="text-text-secondary font-mono">0.01</span>
        </div>
      </div>

      {/* Table Column Headers */}
      <div className="grid grid-cols-3 px-3 py-1 text-text-muted font-medium border-b border-border text-[10px] uppercase tracking-wider">
        <div>Цена (USDT)</div>
        <div className="text-right">Размер</div>
        <div className="text-right">Всего</div>
      </div>

      {/* Main Order Book Container */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        {/* Asks (Sells) - Red */}
        {viewMode !== 'bids' && (
          <div className="flex-1 flex flex-col justify-end overflow-hidden">
            {displayAsks.map((ask, idx) => {
              const price = Number(ask.price);
              const qty = Number(ask.quantity);
              const total = price * qty;
              const depthPercent = Math.min(100, (qty / maxAskTotal) * 100 * 2.2);

              return (
                <div
                  key={`ask-${idx}`}
                  onClick={() => onSelectPrice?.(price)}
                  className="grid grid-cols-3 px-3 h-[21px] items-center relative hover:bg-bg-hover cursor-pointer group transition-colors"
                >
                  {/* Red depth gradient bar */}
                  <div
                    className="absolute right-0 top-0 bottom-0 bg-gradient-to-l from-trade-sell/25 to-trade-sell/5 pointer-events-none transition-all"
                    style={{ width: `${depthPercent}%` }}
                  />
                  <div className="text-trade-sell font-medium z-10 group-hover:underline">
                    {formatPrice(price)}
                  </div>
                  <div className="text-right text-text-primary z-10">{formatQty(qty)}</div>
                  <div className="text-right text-text-secondary z-10">
                    {formatPrice(total, 0)}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Current Price & Spread Banner (Always visible in middle or top/bottom) */}
        <div className="px-3 py-1.5 my-0.5 bg-bg-panel border-y border-border flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center space-x-2">
            <span
              className={`text-sm font-bold flex items-center space-x-1 ${
                isPositive ? 'text-trade-buy' : 'text-trade-sell'
              }`}
            >
              <span>${formatPrice(ticker?.lastPrice)}</span>
              {isPositive ? (
                <ArrowUpRight className="w-3.5 h-3.5" />
              ) : (
                <ArrowDownRight className="w-3.5 h-3.5" />
              )}
            </span>
            <span
              className={`text-[10px] font-semibold ${
                isPositive ? 'text-trade-buy' : 'text-trade-sell'
              }`}
            >
              {isPositive ? '+' : ''}
              {ticker?.priceChangePercent ? Number(ticker.priceChangePercent).toFixed(2) : '0.00'}%
            </span>
          </div>

          <div className="text-[10px] text-text-muted">
            Спред: <span className="text-text-secondary font-mono">{formatPrice(spread, 2)}</span>
          </div>
        </div>

        {/* Bids (Buys) - Green */}
        {viewMode !== 'asks' && (
          <div className="flex-1 flex flex-col justify-start overflow-hidden">
            {displayBids.map((bid, idx) => {
              const price = Number(bid.price);
              const qty = Number(bid.quantity);
              const total = price * qty;
              const depthPercent = Math.min(100, (qty / maxBidTotal) * 100 * 2.2);

              return (
                <div
                  key={`bid-${idx}`}
                  onClick={() => onSelectPrice?.(price)}
                  className="grid grid-cols-3 px-3 h-[21px] items-center relative hover:bg-bg-hover cursor-pointer group transition-colors"
                >
                  {/* Green depth gradient bar */}
                  <div
                    className="absolute right-0 top-0 bottom-0 bg-gradient-to-l from-trade-buy/25 to-trade-buy/5 pointer-events-none transition-all"
                    style={{ width: `${depthPercent}%` }}
                  />
                  <div className="text-trade-buy font-medium z-10 group-hover:underline">
                    {formatPrice(price)}
                  </div>
                  <div className="text-right text-text-primary z-10">{formatQty(qty)}</div>
                  <div className="text-right text-text-secondary z-10">
                    {formatPrice(total, 0)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
