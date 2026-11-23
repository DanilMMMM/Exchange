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
    <div className="flex flex-col h-[calc(100vh-3rem)] overflow-hidden bg-bg-primary">
      {/* 24h Market Banner */}
      <MarketHeader mode={mode} />

      {/* Main 3-column Trading Grid */}
      <div className="flex-1 grid grid-cols-12 overflow-hidden">
        {/* Left Column: Chart & Bottom Tabs (Col 1 to 7 on lg/xl) */}
        <div className="col-span-12 lg:col-span-6 xl:col-span-7 flex flex-col h-full border-r border-border overflow-hidden">
          {/* Chart Section */}
          <div className="flex-1 min-h-[300px] relative overflow-hidden border-b border-border">
            <TradingChart />
          </div>

          {/* Bottom Positions & Orders Panel */}
          <div className="h-64 min-h-[220px] bg-bg-card overflow-hidden">
            <PositionsAndOrders mode={mode} />
          </div>
        </div>

        {/* Center-Right Column: Order Book & Trades (Col 8 to 9 on xl) */}
        <div className="hidden lg:flex col-span-3 xl:col-span-2.5 flex-col h-full bg-bg-card border-r border-border overflow-hidden">
          {/* Tab switch */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-bg-secondary text-xs">
            <div className="flex space-x-1">
              <button
                onClick={() => setRightTab('book')}
                className={`flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  rightTab === 'book'
                    ? 'bg-bg-panel text-accent-gold border border-border shadow-sm'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                <BookOpen className="w-3 h-3" />
                <span>Order Book</span>
              </button>
              <button
                onClick={() => setRightTab('trades')}
                className={`flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  rightTab === 'trades'
                    ? 'bg-bg-panel text-accent-gold border border-border shadow-sm'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                <Activity className="w-3 h-3" />
                <span>Trades</span>
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

        {/* Right Column: Order Placement Form (Col 10 to 12) */}
        <div className="col-span-12 lg:col-span-3 xl:col-span-2.5 flex flex-col h-full bg-bg-card overflow-y-auto">
          <OrderForm mode={mode} selectedPrice={selectedBookPrice} />
        </div>
      </div>
    </div>
  );
};
