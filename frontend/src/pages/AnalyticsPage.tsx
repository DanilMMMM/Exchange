import React, { useState, useEffect } from 'react';
import { endpoints } from '../api/client';
import { PortfolioAnalytics } from '../types';
import { formatPrice, formatPercent } from '../utils/formatters';
import { Download, TrendingUp, Award, DollarSign } from 'lucide-react';

export const AnalyticsPage: React.FC = () => {
  const [data, setData] = useState<PortfolioAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      const res = await endpoints.getPortfolioAnalytics();
      setData(res.data);
    } catch {
      // Fallback sample data if newly registered with no trades
      setData({
        totalValueUsdt: 25000,
        allocations: [{ symbol: 'USDT', valueUsdt: 25000, percentage: 100 }],
        totalRealizedPnl: 0,
        winRate: 0,
        totalTrades: 0,
        winTrades: 0,
        lossTrades: 0,
        bestTrade: 0,
        worstTrade: 0,
        totalCommissions: 0,
        equityCurve: [
          { date: new Date().toISOString(), equityUsdt: 25000 },
        ],
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const res = await endpoints.exportTradesCsv();
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `trades_export_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      alert('Failed to export trades to CSV');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center text-xs text-text-muted">
        Loading analytics...
      </div>
    );
  }

  const isProfit = (data?.totalRealizedPnl ?? 0) >= 0;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 select-none tabular-nums">
      {/* Header & Export Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary mb-1">
            Portfolio & Trading Analytics
          </h1>
          <p className="text-xs text-text-muted">
            Performance metrics, asset allocation, and trade journal analysis
          </p>
        </div>

        <button
          onClick={handleExportCsv}
          disabled={exporting}
          className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-bg-card hover:bg-bg-hover text-text-primary font-semibold border border-border text-xs transition-colors shadow-sm self-start sm:self-auto"
        >
          <Download className="w-4 h-4 text-accent-gold" />
          <span>{exporting ? 'Exporting...' : 'Export Trades CSV'}</span>
        </button>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-bg-card border border-border p-4 rounded-xl shadow-lg">
          <div className="flex items-center justify-between text-text-muted mb-2">
            <span className="text-[10px] uppercase font-medium">Total Realized PnL</span>
            <DollarSign className="w-4 h-4 text-accent-gold" />
          </div>
          <div
            className={`text-xl font-bold ${
              isProfit ? 'text-trade-buy' : 'text-trade-sell'
            }`}
          >
            {isProfit ? '+' : ''}
            {formatPrice(data?.totalRealizedPnl)} USDT
          </div>
        </div>

        <div className="bg-bg-card border border-border p-4 rounded-xl shadow-lg">
          <div className="flex items-center justify-between text-text-muted mb-2">
            <span className="text-[10px] uppercase font-medium">Win Rate</span>
            <Award className="w-4 h-4 text-accent-gold" />
          </div>
          <div className="text-xl font-bold text-accent-gold">
            {formatPercent(data?.winRate)}
          </div>
          <div className="text-[10px] text-text-muted mt-1">
            {data?.winTrades} Wins / {data?.lossTrades} Losses
          </div>
        </div>

        <div className="bg-bg-card border border-border p-4 rounded-xl shadow-lg">
          <div className="flex items-center justify-between text-text-muted mb-2">
            <span className="text-[10px] uppercase font-medium">Total Trades Executed</span>
            <TrendingUp className="w-4 h-4 text-text-muted" />
          </div>
          <div className="text-xl font-bold text-text-primary">
            {data?.totalTrades}
          </div>
          <div className="text-[10px] text-text-muted mt-1">
            Commissions: ${formatPrice(data?.totalCommissions, 4)}
          </div>
        </div>

        <div className="bg-bg-card border border-border p-4 rounded-xl shadow-lg">
          <div className="flex items-center justify-between text-text-muted mb-2">
            <span className="text-[10px] uppercase font-medium">Best / Worst Trade</span>
            <DollarSign className="w-4 h-4 text-accent-gold" />
          </div>
          <div className="text-xs font-bold text-trade-buy">
            Best: +${formatPrice(data?.bestTrade)}
          </div>
          <div className="text-xs font-bold text-trade-sell mt-1">
            Worst: ${formatPrice(data?.worstTrade)}
          </div>
        </div>
      </div>

      {/* Charts & Allocations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Equity Curve (2 cols) */}
        <div className="lg:col-span-2 bg-bg-card border border-border rounded-xl p-5 shadow-xl">
          <h3 className="font-bold text-sm text-text-primary mb-1">Equity Growth Curve</h3>
          <p className="text-xs text-text-muted mb-4">
            Cumulative portfolio value trend over time
          </p>

          <div className="h-64 flex flex-col justify-end bg-bg-panel/40 p-4 rounded-lg border border-border/50 relative overflow-hidden">
            {/* Visual equity points */}
            <div className="flex-1 flex items-end space-x-2 pt-6">
              {(data?.equityCurve || []).map((pt, i) => {
                const heightPercent = Math.min(100, Math.max(15, (pt.equityUsdt / 35000) * 100));
                return (
                  <div
                    key={i}
                    className="flex-1 flex flex-col items-center justify-end h-full group"
                  >
                    <div
                      className="w-full bg-accent-gold/40 hover:bg-accent-gold rounded-t transition-all"
                      style={{ height: `${heightPercent}%` }}
                    />
                    <span className="text-[9px] text-text-muted mt-1 hidden sm:block">
                      {new Date(pt.date).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="text-right text-[10px] text-text-muted pt-2 border-t border-border">
              Current Equity: ${formatPrice(data?.totalValueUsdt)} USDT
            </div>
          </div>
        </div>

        {/* Asset Allocation Breakdown */}
        <div className="bg-bg-card border border-border rounded-xl p-5 shadow-xl">
          <h3 className="font-bold text-sm text-text-primary mb-1">Asset Allocation</h3>
          <p className="text-xs text-text-muted mb-4">
            Portfolio distribution by cryptocurrency
          </p>

          <div className="space-y-3">
            {(data?.allocations || []).map((a) => (
              <div key={a.symbol} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-text-primary">{a.symbol}</span>
                  <span className="text-text-muted">
                    ${formatPrice(a.valueUsdt)} ({a.percentage.toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full h-2 bg-bg-panel rounded-full overflow-hidden border border-border/50">
                  <div
                    className="h-full bg-gradient-to-r from-accent-gold to-yellow-500 rounded-full"
                    style={{ width: `${Math.min(100, Math.max(2, a.percentage))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
