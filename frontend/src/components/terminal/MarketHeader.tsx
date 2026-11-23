import React, { useState } from 'react';
import { useMarketStore } from '../../store/useMarketStore';
import { formatPrice, formatPercent } from '../../utils/formatters';
import { ChevronDown, Search, Star } from 'lucide-react';

interface MarketHeaderProps {
  mode: 'spot' | 'futures';
}

export const MarketHeader: React.FC<MarketHeaderProps> = ({ mode }) => {
  const { pairs, tickers, selectedSymbol, setSelectedSymbol, favorites, toggleFavorite } =
    useMarketStore();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [search, setSearch] = useState('');

  const ticker = tickers[selectedSymbol];
  const isUp = (ticker?.priceChangePercent ?? 0) >= 0;

  const filteredPairs = pairs.filter((p) => {
    const matchesSearch = p.symbol.toLowerCase().includes(search.toLowerCase());
    if (mode === 'spot') return matchesSearch && p.isSpotActive;
    return matchesSearch && p.isFuturesActive;
  });

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-bg-card border-b border-border text-xs select-none">
      {/* Symbol Selector Dropdown */}
      <div className="relative">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center space-x-2 py-1 px-2.5 rounded bg-bg-panel hover:bg-bg-hover transition-colors border border-border"
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(selectedSymbol);
            }}
            className="text-text-muted hover:text-accent-gold"
          >
            <Star
              className={`w-3.5 h-3.5 ${
                favorites.includes(selectedSymbol)
                  ? 'fill-accent-gold text-accent-gold'
                  : ''
              }`}
            />
          </button>
          <span className="font-bold text-sm text-text-primary tracking-wide">
            {selectedSymbol}
          </span>
          <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-bg-primary text-text-secondary uppercase">
            {mode}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-text-secondary" />
        </button>

        {dropdownOpen && (
          <div className="absolute top-full left-0 mt-1 w-72 bg-bg-card border border-border rounded-lg shadow-2xl z-50 overflow-hidden">
            <div className="p-2 border-b border-border flex items-center space-x-2">
              <Search className="w-4 h-4 text-text-muted" />
              <input
                type="text"
                placeholder="Search symbol (e.g. BTC)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent text-xs text-text-primary focus:outline-none placeholder:text-text-muted"
                autoFocus
              />
            </div>
            <div className="max-h-64 overflow-y-auto divide-y divide-border/40">
              {filteredPairs.map((p) => {
                const t = tickers[p.symbol];
                const change = t?.priceChangePercent ?? 0;
                return (
                  <div
                    key={p.symbol}
                    onClick={() => {
                      setSelectedSymbol(p.symbol);
                      setDropdownOpen(false);
                    }}
                    className={`flex items-center justify-between px-3 py-2 cursor-pointer transition-colors ${
                      p.symbol === selectedSymbol ? 'bg-bg-panel' : 'hover:bg-bg-hover'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <Star
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(p.symbol);
                        }}
                        className={`w-3.5 h-3.5 cursor-pointer ${
                          favorites.includes(p.symbol)
                            ? 'fill-accent-gold text-accent-gold'
                            : 'text-text-muted hover:text-text-primary'
                        }`}
                      />
                      <span className="font-semibold text-text-primary">{p.symbol}</span>
                    </div>
                    <div className="text-right tabular-nums">
                      <div className="text-text-primary font-medium">
                        ${formatPrice(t?.lastPrice, p.precisionPrice)}
                      </div>
                      <div className={change >= 0 ? 'text-trade-buy' : 'text-trade-sell'}>
                        {formatPercent(change)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 24h Market Stats Row */}
      <div className="flex items-center space-x-6 overflow-x-auto tabular-nums">
        <div>
          <div className="text-[10px] text-text-muted uppercase">Last Price</div>
          <div
            className={`text-sm font-bold ${
              isUp ? 'text-trade-buy' : 'text-trade-sell'
            }`}
          >
            ${formatPrice(ticker?.lastPrice)}
          </div>
        </div>

        <div>
          <div className="text-[10px] text-text-muted uppercase">24h Change</div>
          <div
            className={`font-semibold ${
              isUp ? 'text-trade-buy' : 'text-trade-sell'
            }`}
          >
            {formatPercent(ticker?.priceChangePercent)}
          </div>
        </div>

        <div className="hidden sm:block">
          <div className="text-[10px] text-text-muted uppercase">24h High</div>
          <div className="text-text-primary font-medium">
            ${formatPrice(ticker?.high24h)}
          </div>
        </div>

        <div className="hidden sm:block">
          <div className="text-[10px] text-text-muted uppercase">24h Low</div>
          <div className="text-text-primary font-medium">
            ${formatPrice(ticker?.low24h)}
          </div>
        </div>

        <div className="hidden md:block">
          <div className="text-[10px] text-text-muted uppercase">24h Volume (USDT)</div>
          <div className="text-text-primary font-medium">
            {formatPrice(ticker?.quoteVolume24h ?? ticker?.volume24h, 0)}
          </div>
        </div>
      </div>
    </div>
  );
};
