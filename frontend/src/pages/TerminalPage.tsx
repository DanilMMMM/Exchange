import React, { useState } from 'react';
import { MarketHeader } from '../components/terminal/MarketHeader';
import { TradingChart } from '../components/terminal/TradingChart';
import { OrderBook } from '../components/terminal/OrderBook';
import { MarketTrades } from '../components/terminal/MarketTrades';
import { OrderForm } from '../components/terminal/OrderForm';
import { PositionsAndOrders } from '../components/terminal/PositionsAndOrders';
import { BookOpen, Activity } from 'lucide-react';

interface TerminalPageProps {
  mode: 'spot' | 'futures';
}

export const TerminalPage: React.FC<TerminalPageProps> = ({ mode }) => {
  const [rightTab, setRightTab] = useState<'book' | 'trades'>('book');
  const [selectedBookPrice, setSelectedBookPrice] = useState<number | null>(null);

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] w-full overflow-hidden bg-bg-primary">
      {/* Top 24h Market Banner */}
      <MarketHeader mode={mode} />

      {/* Main 3-column Pro Trading Terminal Grid */}
      <div className="flex-1 flex w-full overflow-hidden min-h-0">
        {/* Column 1: Chart & Bottom Tabs (Flex-1 expands to fill all remaining space!) */}
        <div className="flex-1 flex flex-col min-w-0 h-full border-r border-border overflow-hidden">
          {/* Chart Section */}
          <div className="flex-1 min-h-[350px] relative overflow-hidden">
            <TradingChart />
          </div>

          {/* Bottom Positions & Orders Panel */}
          <div className="h-72 min-h-[220px] bg-bg-card border-t border-border overflow-hidden">
            <PositionsAndOrders mode={mode} />
          </div>
        </div>

        {/* Column 2: Order Book & Trades (Fixed 300px - 340px) */}
        <div className="w-72 xl:w-80 shrink-0 flex flex-col h-full bg-bg-card border-r border-border overflow-hidden">
          {/* Tab switch */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-bg-secondary text-xs">
            <div className="flex space-x-1">
              <button
                onClick={() => setRightTab('book')}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs font-semibold transition-all ${
                  rightTab === 'book'
                    ? 'bg-bg-panel text-accent-gold border border-border shadow-sm'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Order Book</span>
              </button>
              <button
                onClick={() => setRightTab('trades')}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs font-semibold transition-all ${
                  rightTab === 'trades'
                    ? 'bg-bg-panel text-accent-gold border border-border shadow-sm'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Recent Trades</span>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            {rightTab === 'book' ? (
              <OrderBook onSelectPrice={(p) => setSelectedBookPrice(p)} />
            ) : (
              <MarketTrades />
            )}
          </div>
        </div>

        {/* Column 3: Order Placement Form (Fixed 300px - 340px) */}
        <div className="w-72 xl:w-80 shrink-0 flex flex-col h-full bg-bg-card overflow-y-auto">
          <OrderForm mode={mode} selectedPrice={selectedBookPrice} />
        </div>
      </div>
    </div>
  );
};
