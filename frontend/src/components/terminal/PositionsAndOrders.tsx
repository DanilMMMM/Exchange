import React, { useState } from 'react';
import { useTradeStore } from '../../store/useTradeStore';
import { useMarketStore } from '../../store/useMarketStore';
import { formatPrice, formatPercent, formatDateTime } from '../../utils/formatters';
import { X, Edit2 } from 'lucide-react';

interface PositionsAndOrdersProps {
  mode: 'spot' | 'futures';
}

export const PositionsAndOrders: React.FC<PositionsAndOrdersProps> = ({ mode }) => {
  const {
    positions,
    openOrders,
    orderHistory,
    tradeHistory,
    cancelOrder,
    closePosition,
    editTpSl,
  } = useTradeStore();
  const { tickers } = useMarketStore();

  const [activeTab, setActiveTab] = useState<
    'positions' | 'openOrders' | 'orderHistory' | 'tradeHistory'
  >(mode === 'futures' ? 'positions' : 'openOrders');

  // Modal for editing TP/SL
  const [editingPosition, setEditingPosition] = useState<any | null>(null);
  const [editTp, setEditTp] = useState('');
  const [editSl, setEditSl] = useState('');

  const handleOpenTpSl = (pos: any) => {
    setEditingPosition(pos);
    setEditTp(pos.takeProfit ? pos.takeProfit.toString() : '');
    setEditSl(pos.stopLoss ? pos.stopLoss.toString() : '');
  };

  const handleSaveTpSl = async () => {
    if (!editingPosition) return;
    await editTpSl(
      editingPosition.id,
      editTp ? Number(editTp) : undefined,
      editSl ? Number(editSl) : undefined
    );
    setEditingPosition(null);
  };

  return (
    <div className="flex flex-col h-full bg-bg-card border-t border-border select-none text-xs">
      {/* Tab Navigation */}
      <div className="flex items-center space-x-6 px-4 py-2 border-b border-border bg-bg-secondary text-[11px] font-medium">
        {mode === 'futures' && (
          <button
            onClick={() => setActiveTab('positions')}
            className={`transition-colors py-1 relative ${
              activeTab === 'positions'
                ? 'text-accent-gold font-semibold'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            Positions ({positions.length})
            {activeTab === 'positions' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-gold" />
            )}
          </button>
        )}

        <button
          onClick={() => setActiveTab('openOrders')}
          className={`transition-colors py-1 relative ${
            activeTab === 'openOrders'
              ? 'text-accent-gold font-semibold'
              : 'text-text-muted hover:text-text-primary'
          }`}
        >
          Open Orders ({openOrders.length})
          {activeTab === 'openOrders' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-gold" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('orderHistory')}
          className={`transition-colors py-1 relative ${
            activeTab === 'orderHistory'
              ? 'text-accent-gold font-semibold'
              : 'text-text-muted hover:text-text-primary'
          }`}
        >
          Order History
          {activeTab === 'orderHistory' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-gold" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('tradeHistory')}
          className={`transition-colors py-1 relative ${
            activeTab === 'tradeHistory'
              ? 'text-accent-gold font-semibold'
              : 'text-text-muted hover:text-text-primary'
          }`}
        >
          Trade History
          {activeTab === 'tradeHistory' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-gold" />
          )}
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto tabular-nums">
        {/* POSITIONS TAB */}
        {activeTab === 'positions' && (
          <div className="min-w-[800px]">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border text-[10px] text-text-muted uppercase">
                  <th className="py-2 px-3">Symbol / Dir</th>
                  <th className="py-2 px-3">Size</th>
                  <th className="py-2 px-3">Entry Price</th>
                  <th className="py-2 px-3">Mark Price</th>
                  <th className="py-2 px-3">Liq. Price</th>
                  <th className="py-2 px-3">Margin</th>
                  <th className="py-2 px-3">PnL (ROE %)</th>
                  <th className="py-2 px-3">TP / SL</th>
                  <th className="py-2 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50 text-[11px]">
                {positions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-8 text-text-muted">
                      No open positions
                    </td>
                  </tr>
                ) : (
                  positions.map((pos) => {
                    const markPrice = tickers[pos.symbol]?.lastPrice ?? pos.markPrice;
                    const notional = pos.quantity * markPrice;
                    const entryNotional = pos.quantity * pos.entryPrice;
                    const livePnl =
                      pos.direction === 'Long'
                        ? notional - entryNotional
                        : entryNotional - notional;
                    const liveRoe =
                      pos.initialMargin > 0
                        ? (livePnl / pos.initialMargin) * 100
                        : 0;
                    const isProfit = livePnl >= 0;

                    return (
                      <tr key={pos.id} className="hover:bg-bg-hover transition-colors">
                        <td className="py-2 px-3 font-semibold text-text-primary">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[10px] mr-1.5 font-bold ${
                              pos.direction === 'Long'
                                ? 'bg-trade-buy/20 text-trade-buy'
                                : 'bg-trade-sell/20 text-trade-sell'
                            }`}
                          >
                            {pos.direction} {pos.leverage}x
                          </span>
                          {pos.symbol}
                        </td>
                        <td className="py-2 px-3 font-medium text-text-primary">
                          {pos.quantity}
                        </td>
                        <td className="py-2 px-3 text-text-primary font-medium">
                          ${formatPrice(pos.entryPrice)}
                        </td>
                        <td className="py-2 px-3 text-text-primary font-medium">
                          ${formatPrice(markPrice)}
                        </td>
                        <td className="py-2 px-3 text-trade-sell font-bold">
                          ${formatPrice(pos.liquidationPrice)}
                        </td>
                        <td className="py-2 px-3 text-text-primary">
                          {formatPrice(pos.initialMargin)} USDT
                        </td>
                        <td
                          className={`py-2 px-3 font-bold ${
                            isProfit ? 'text-trade-buy' : 'text-trade-sell'
                          }`}
                        >
                          {isProfit ? '+' : ''}
                          {formatPrice(livePnl)} USDT ({formatPercent(liveRoe)})
                        </td>
                        <td className="py-2 px-3 text-text-muted">
                          <div className="flex items-center space-x-1">
                            <span>
                              {pos.takeProfit ? `$${pos.takeProfit}` : '--'} /{' '}
                              {pos.stopLoss ? `$${pos.stopLoss}` : '--'}
                            </span>
                            <button
                              onClick={() => handleOpenTpSl(pos)}
                              className="p-1 hover:text-accent-gold"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <button
                            onClick={() => closePosition(pos.id)}
                            className="px-2 py-1 rounded bg-bg-panel hover:bg-trade-sell hover:text-white border border-border text-text-secondary text-[10px] font-semibold transition-colors"
                          >
                            Close Market
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* OPEN ORDERS TAB */}
        {activeTab === 'openOrders' && (
          <div className="min-w-[800px]">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border text-[10px] text-text-muted uppercase">
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">Symbol</th>
                  <th className="py-2 px-3">Type</th>
                  <th className="py-2 px-3">Side</th>
                  <th className="py-2 px-3">Price</th>
                  <th className="py-2 px-3">Amount</th>
                  <th className="py-2 px-3">Filled</th>
                  <th className="py-2 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50 text-[11px]">
                {openOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-text-muted">
                      No open orders
                    </td>
                  </tr>
                ) : (
                  openOrders.map((ord) => (
                    <tr key={ord.id} className="hover:bg-bg-hover transition-colors">
                      <td className="py-2 px-3 text-text-muted">
                        {formatDateTime(ord.createdAt)}
                      </td>
                      <td className="py-2 px-3 font-semibold text-text-primary">
                        {ord.symbol}
                      </td>
                      <td className="py-2 px-3 text-text-secondary">
                        {ord.orderType}
                      </td>
                      <td
                        className={`py-2 px-3 font-bold ${
                          ord.side === 'Buy' ? 'text-trade-buy' : 'text-trade-sell'
                        }`}
                      >
                        {ord.side}
                      </td>
                      <td className="py-2 px-3 font-medium text-text-primary">
                        ${formatPrice(ord.price)}
                      </td>
                      <td className="py-2 px-3 text-text-primary">{ord.quantity}</td>
                      <td className="py-2 px-3 text-text-muted">
                        {ord.filledQuantity} ({((ord.filledQuantity / ord.quantity) * 100).toFixed(0)}%)
                      </td>
                      <td className="py-2 px-3 text-right">
                        <button
                          onClick={() => cancelOrder(ord.id)}
                          className="px-2 py-0.5 rounded bg-bg-panel hover:bg-trade-sell hover:text-white border border-border text-text-secondary text-[10px] font-semibold transition-colors"
                        >
                          Cancel
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ORDER HISTORY TAB */}
        {activeTab === 'orderHistory' && (
          <div className="min-w-[800px]">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border text-[10px] text-text-muted uppercase">
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">Symbol</th>
                  <th className="py-2 px-3">Type</th>
                  <th className="py-2 px-3">Side</th>
                  <th className="py-2 px-3">Avg Price</th>
                  <th className="py-2 px-3">Executed</th>
                  <th className="py-2 px-3">Fee</th>
                  <th className="py-2 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50 text-[11px]">
                {orderHistory.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-text-muted">
                      No order history
                    </td>
                  </tr>
                ) : (
                  orderHistory.map((ord) => (
                    <tr key={ord.id} className="hover:bg-bg-hover">
                      <td className="py-2 px-3 text-text-muted">
                        {formatDateTime(ord.createdAt)}
                      </td>
                      <td className="py-2 px-3 font-semibold text-text-primary">
                        {ord.symbol}
                      </td>
                      <td className="py-2 px-3 text-text-secondary">
                        {ord.orderType}
                      </td>
                      <td
                        className={`py-2 px-3 font-bold ${
                          ord.side === 'Buy' ? 'text-trade-buy' : 'text-trade-sell'
                        }`}
                      >
                        {ord.side}
                      </td>
                      <td className="py-2 px-3 text-text-primary">
                        ${formatPrice(ord.avgFillPrice ?? ord.price)}
                      </td>
                      <td className="py-2 px-3 text-text-primary">
                        {ord.filledQuantity} / {ord.quantity}
                      </td>
                      <td className="py-2 px-3 text-text-muted">
                        {formatPrice(ord.commission, 4)} USDT
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            ord.status === 'Filled'
                              ? 'bg-trade-buy/20 text-trade-buy'
                              : ord.status === 'Cancelled'
                              ? 'bg-bg-panel text-text-muted'
                              : 'bg-accent-gold/20 text-accent-gold'
                          }`}
                        >
                          {ord.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TRADE HISTORY TAB */}
        {activeTab === 'tradeHistory' && (
          <div className="min-w-[800px]">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border text-[10px] text-text-muted uppercase">
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">Symbol</th>
                  <th className="py-2 px-3">Market</th>
                  <th className="py-2 px-3">Side</th>
                  <th className="py-2 px-3">Price</th>
                  <th className="py-2 px-3">Quantity</th>
                  <th className="py-2 px-3">Total (USDT)</th>
                  <th className="py-2 px-3">Fee</th>
                  <th className="py-2 px-3">Realized PnL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50 text-[11px]">
                {tradeHistory.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-8 text-text-muted">
                      No trades yet
                    </td>
                  </tr>
                ) : (
                  tradeHistory.map((t) => (
                    <tr key={t.id} className="hover:bg-bg-hover">
                      <td className="py-2 px-3 text-text-muted">
                        {formatDateTime(t.createdAt)}
                      </td>
                      <td className="py-2 px-3 font-semibold text-text-primary">
                        {t.symbol}
                      </td>
                      <td className="py-2 px-3 text-text-secondary">
                        {t.marketType}
                      </td>
                      <td
                        className={`py-2 px-3 font-bold ${
                          t.side === 'Buy' ? 'text-trade-buy' : 'text-trade-sell'
                        }`}
                      >
                        {t.side}
                      </td>
                      <td className="py-2 px-3 font-medium text-text-primary">
                        ${formatPrice(t.price)}
                      </td>
                      <td className="py-2 px-3 text-text-primary">{t.quantity}</td>
                      <td className="py-2 px-3 text-text-primary font-medium">
                        ${formatPrice(t.total)}
                      </td>
                      <td className="py-2 px-3 text-text-muted">
                        {formatPrice(t.commission, 4)} USDT
                      </td>
                      <td
                        className={`py-2 px-3 font-semibold ${
                          (t.realizedPnl ?? 0) >= 0
                            ? 'text-trade-buy'
                            : 'text-trade-sell'
                        }`}
                      >
                        {t.realizedPnl !== undefined && t.realizedPnl !== null
                          ? `${(t.realizedPnl >= 0 ? '+' : '')}${formatPrice(t.realizedPnl)} USDT`
                          : '--'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit TP / SL Modal */}
      {editingPosition && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-bg-card border border-border rounded-xl w-full max-w-sm p-4 shadow-2xl">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-sm text-text-primary">
                Edit TP / SL ({editingPosition.symbol})
              </h3>
              <button
                onClick={() => setEditingPosition(null)}
                className="text-text-muted hover:text-text-primary"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-[10px] text-text-muted mb-1 font-medium">
                  Take Profit Price (USDT)
                </label>
                <input
                  type="number"
                  step="any"
                  value={editTp}
                  onChange={(e) => setEditTp(e.target.value)}
                  placeholder="e.g. 95000"
                  className="w-full bg-bg-panel border border-border rounded px-2.5 py-1.5 text-text-primary tabular-nums focus:outline-none focus:border-accent-gold"
                />
              </div>
              <div>
                <label className="block text-[10px] text-text-muted mb-1 font-medium">
                  Stop Loss Price (USDT)
                </label>
                <input
                  type="number"
                  step="any"
                  value={editSl}
                  onChange={(e) => setEditSl(e.target.value)}
                  placeholder="e.g. 88000"
                  className="w-full bg-bg-panel border border-border rounded px-2.5 py-1.5 text-text-primary tabular-nums focus:outline-none focus:border-accent-gold"
                />
              </div>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setEditingPosition(null)}
                className="flex-1 py-1.5 rounded bg-bg-panel hover:bg-bg-hover text-text-secondary font-medium border border-border"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTpSl}
                className="flex-1 py-1.5 rounded bg-accent-gold hover:bg-accent-gold-hover text-bg-primary font-bold shadow"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
