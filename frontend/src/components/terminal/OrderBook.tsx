import React, { useMemo } from 'react';
import { useMarketStore } from '../../store/useMarketStore';
import { formatPrice, formatQty } from '../../utils/formatters';

interface OrderBookProps {
  onSelectPrice?: (price: number) => void;
}

export const OrderBook: React.FC<OrderBookProps> = ({ onSelectPrice }) => {
  const { orderBook, tickers, selectedSymbol } = useMarketStore();
  const ticker = tickers[selectedSymbol];

  const bids = orderBook?.bids || [];
  const asks = orderBook?.asks || [];

  // Compute depth volume totals for visualization bars
  const maxAskTotal = useMemo(() => {
    let sum = 0;
    asks.slice(0, 15).forEach((a) => (sum += Number(a.quantity)));
    return sum || 1;
  }, [asks]);

  const maxBidTotal = useMemo(() => {
    let sum = 0;
    bids.slice(0, 15).forEach((b) => (sum += Number(b.quantity)));
    return sum || 1;
  }, [bids]);

  const spread = useMemo(() => {
    if (asks.length > 0 && bids.length > 0) {
      return Math.max(0, Number(asks[0].price) - Number(bids[0].price));
    }
    return 0;
  }, [asks, bids]);

  return (
    <div className="flex flex-col h-full bg-bg-card select-none text-[11px] tabular-nums">
      {/* Header */}
      <div className="grid grid-cols-3 px-3 py-1.5 text-text-muted font-medium border-b border-border text-[10px] uppercase">
        <div>Price (USDT)</div>
        <div className="text-right">Size</div>
        <div className="text-right">Total</div>
      </div>

      {/* Asks (Sells) - Reversed so lowest ask is at bottom near current price */}
      <div className="flex-1 flex flex-col justify-end overflow-hidden divide-y divide-transparent">
        {asks
          .slice(0, 12)
          .reverse()
          .map((ask, idx) => {
            const price = Number(ask.price);
            const qty = Number(ask.quantity);
            const total = price * qty;
            const depthPercent = Math.min(100, (qty / maxAskTotal) * 100 * 2.5);

            return (
              <div
                key={`ask-${idx}`}
                onClick={() => onSelectPrice?.(price)}
                className="grid grid-cols-3 px-3 py-0.5 relative hover:bg-bg-hover cursor-pointer"
              >
                {/* Red depth bar */}
                <div
                  className="absolute right-0 top-0 bottom-0 bg-trade-sell/15 pointer-events-none"
                  style={{ width: `${depthPercent}%` }}
                />
                <div className="text-trade-sell font-medium z-10">
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

      {/* Current Price & Spread Banner */}
      <div className="px-3 py-2 my-1 bg-bg-panel border-y border-border flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span
            className={`text-sm font-bold ${
              (ticker?.priceChangePercent ?? 0) >= 0
                ? 'text-trade-buy'
                : 'text-trade-sell'
            }`}
          >
            ${formatPrice(ticker?.lastPrice)}
          </span>
          <span className="text-[10px] text-text-muted">
            Spread: {formatPrice(spread, 3)}
          </span>
        </div>
      </div>

      {/* Bids (Buys) - Highest bid at top near current price */}
      <div className="flex-1 overflow-hidden divide-y divide-transparent">
        {bids.slice(0, 12).map((bid, idx) => {
          const price = Number(bid.price);
          const qty = Number(bid.quantity);
          const total = price * qty;
          const depthPercent = Math.min(100, (qty / maxBidTotal) * 100 * 2.5);

          return (
            <div
              key={`bid-${idx}`}
              onClick={() => onSelectPrice?.(price)}
              className="grid grid-cols-3 px-3 py-0.5 relative hover:bg-bg-hover cursor-pointer"
            >
              {/* Green depth bar */}
              <div
                className="absolute right-0 top-0 bottom-0 bg-trade-buy/15 pointer-events-none"
                style={{ width: `${depthPercent}%` }}
              />
              <div className="text-trade-buy font-medium z-10">
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
    </div>
  );
};
