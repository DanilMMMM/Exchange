import React from 'react';
import { useMarketStore } from '../../store/useMarketStore';
import { formatPrice, formatQty } from '../../utils/formatters';

export const MarketTrades: React.FC = () => {
  const { marketTrades } = useMarketStore();

  const formatTime = (ts: number) => {
    const d = new Date(ts * 1000);
    return d.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="flex flex-col h-full bg-bg-card select-none text-[11px] tabular-nums">
      {/* Header */}
      <div className="grid grid-cols-3 px-3 py-1.5 text-text-muted font-medium border-b border-border text-[10px] uppercase">
        <div>Price (USDT)</div>
        <div className="text-right">Size</div>
        <div className="text-right">Time</div>
      </div>

      {/* Trades List */}
      <div className="flex-1 overflow-y-auto divide-y divide-transparent">
        {marketTrades.slice(0, 30).map((t, idx) => {
          const isBuy = t.side === 'Buy';
          return (
            <div
              key={`${t.time}-${idx}`}
              className="grid grid-cols-3 px-3 py-0.5 hover:bg-bg-hover"
            >
              <div
                className={`font-medium ${
                  isBuy ? 'text-trade-buy' : 'text-trade-sell'
                }`}
              >
                {formatPrice(t.price)}
              </div>
              <div className="text-right text-text-primary">{formatQty(t.quantity)}</div>
              <div className="text-right text-text-muted">{formatTime(t.time)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
