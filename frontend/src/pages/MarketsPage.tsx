import React, { useState } from 'react';
import { useMarketStore } from '../store/useMarketStore';
import { formatPrice, formatPercent } from '../utils/formatters';
import { Search, Star, TrendingUp, Layers } from 'lucide-react';

interface MarketsPageProps {
  onSelectPair: (symbol: string, mode: 'spot' | 'futures') => void;
}

export const MarketsPage: React.FC<MarketsPageProps> = ({ onSelectPair }) => {
  const { pairs, tickers, favorites, toggleFavorite } = useMarketStore();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'all' | 'favorites' | 'gainers' | 'losers'>('all');

  const filteredPairs = pairs.filter((p) => {
    const matchesSearch = p.symbol.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;

    if (tab === 'favorites') return favorites.includes(p.symbol);
    return true;
  });

  // Sorting
  const sortedPairs = [...filteredPairs].sort((a, b) => {
    const tA = tickers[a.symbol]?.priceChangePercent ?? 0;
    const tB = tickers[b.symbol]?.priceChangePercent ?? 0;

    if (tab === 'gainers') return tB - tA;
    if (tab === 'losers') return tA - tB;
    // Default: volume or symbol
    const vA = tickers[a.symbol]?.quoteVolume24h ?? 0;
    const vB = tickers[b.symbol]?.quoteVolume24h ?? 0;
    return vB - vA;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 select-none">
      {/* Header & Stats Banner */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary mb-1">Crypto Markets</h1>
        <p className="text-xs text-text-muted">
          Real-time Bybit market quotes across 25+ popular cryptocurrency pairs
        </p>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-border">
        <div className="flex items-center space-x-2 overflow-x-auto">
          {[
            { id: 'all', label: 'All Pairs' },
            { id: 'favorites', label: 'Favorites' },
            { id: 'gainers', label: 'Top Gainers' },
            { id: 'losers', label: 'Top Losers' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                tab === t.id
                  ? 'bg-accent-gold text-bg-primary shadow'
                  : 'bg-bg-card hover:bg-bg-hover text-text-secondary border border-border'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-text-muted absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search coin (BTC, SOL, TON)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-bg-card border border-border rounded-lg pl-9 pr-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent-gold"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden shadow-xl tabular-nums">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border text-[10px] text-text-muted uppercase bg-bg-secondary/50">
                <th className="py-3 px-4">Market Pair</th>
                <th className="py-3 px-4">Last Price</th>
                <th className="py-3 px-4">24h Change</th>
                <th className="py-3 px-4 hidden md:table-cell">24h High</th>
                <th className="py-3 px-4 hidden md:table-cell">24h Low</th>
                <th className="py-3 px-4 hidden lg:table-cell">24h Volume (USDT)</th>
                <th className="py-3 px-4 text-right">Trade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {sortedPairs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-text-muted">
                    No cryptocurrency pairs found matching your criteria
                  </td>
                </tr>
              ) : (
                sortedPairs.map((pair) => {
                  const t = tickers[pair.symbol];
                  const change = t?.priceChangePercent ?? 0;
                  const isUp = change >= 0;
                  const isFav = favorites.includes(pair.symbol);

                  return (
                    <tr
                      key={pair.symbol}
                      className="hover:bg-bg-hover/80 transition-colors group"
                    >
                      {/* Pair symbol + star */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-3">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(pair.symbol);
                            }}
                            className="text-text-muted hover:text-accent-gold"
                          >
                            <Star
                              className={`w-4 h-4 ${
                                isFav
                                  ? 'fill-accent-gold text-accent-gold'
                                  : 'text-text-muted'
                              }`}
                            />
                          </button>
                          <div>
                            <span className="font-bold text-text-primary text-sm mr-1">
                              {pair.baseAsset}
                            </span>
                            <span className="text-[10px] text-text-muted font-medium">
                              /{pair.quoteAsset}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Last Price */}
                      <td className="py-3 px-4 font-semibold text-text-primary">
                        ${formatPrice(t?.lastPrice, pair.precisionPrice)}
                      </td>

                      {/* 24h Change */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded font-bold ${
                            isUp
                              ? 'bg-trade-buy/15 text-trade-buy'
                              : 'bg-trade-sell/15 text-trade-sell'
                          }`}
                        >
                          {formatPercent(change)}
                        </span>
                      </td>

                      {/* 24h High */}
                      <td className="py-3 px-4 text-text-muted hidden md:table-cell">
                        ${formatPrice(t?.high24h)}
                      </td>

                      {/* 24h Low */}
                      <td className="py-3 px-4 text-text-muted hidden md:table-cell">
                        ${formatPrice(t?.low24h)}
                      </td>

                      {/* 24h Volume */}
                      <td className="py-3 px-4 text-text-secondary hidden lg:table-cell font-medium">
                        ${formatPrice(t?.quoteVolume24h ?? t?.volume24h, 0)}
                      </td>

                      {/* Trade Quick Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => onSelectPair(pair.symbol, 'spot')}
                            className="flex items-center space-x-1 px-2.5 py-1 rounded bg-bg-panel hover:bg-accent-gold hover:text-bg-primary text-text-primary font-semibold border border-border text-[11px] transition-all"
                          >
                            <TrendingUp className="w-3 h-3" />
                            <span>Spot</span>
                          </button>
                          <button
                            onClick={() => onSelectPair(pair.symbol, 'futures')}
                            className="flex items-center space-x-1 px-2.5 py-1 rounded bg-accent-gold/15 hover:bg-accent-gold hover:text-bg-primary text-accent-gold font-semibold border border-accent-gold/30 text-[11px] transition-all"
                          >
                            <Layers className="w-3 h-3" />
                            <span>Futures</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
