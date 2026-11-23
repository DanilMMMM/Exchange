import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  HistogramData,
  LineData,
  UTCTimestamp,
  IPriceLine,
} from 'lightweight-charts';
import { useMarketStore } from '../../store/useMarketStore';
import { useTradeStore } from '../../store/useTradeStore';
import {
  TrendingUp,
  Minus,
  Trash2,
  Plus,
  BarChart2,
  Percent,
} from 'lucide-react';

const TIMEFRAMES = [
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '1h', value: '1h' },
  { label: '4h', value: '4h' },
  { label: '1D', value: '1d' },
];

interface CustomLevel {
  id: string;
  price: number;
  type: 'support' | 'resistance' | 'custom';
  color: string;
  title: string;
}

export const TradingChart: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const ema20SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const sma50SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  const priceLinesRef = useRef<Map<string, IPriceLine>>(new Map());

  const { selectedSymbol, klines, klineInterval, setKlineInterval, tickers } =
    useMarketStore();
  const { positions, openOrders } = useTradeStore();

  // Indicators toggle
  const [showEma, setShowEma] = useState(true);
  const [showVolume, setShowVolume] = useState(true);
  const [showFibo, setShowFibo] = useState(false);

  // User-drawn levels saved per symbol
  const [userLevels, setUserLevels] = useState<CustomLevel[]>(() => {
    try {
      const saved = localStorage.getItem(`levels_${selectedSymbol}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Modal / Input for adding level manually
  const [newLevelPrice, setNewLevelPrice] = useState<string>('');
  const [newLevelType, setNewLevelType] = useState<'support' | 'resistance' | 'custom'>('support');
  const [showAddLevelModal, setShowAddLevelModal] = useState(false);

  const ticker = tickers[selectedSymbol];
  const currentPrice = ticker?.lastPrice ?? 0;

  // Save levels to localStorage whenever updated
  useEffect(() => {
    localStorage.setItem(`levels_${selectedSymbol}`, JSON.stringify(userLevels));
  }, [userLevels, selectedSymbol]);

  // Load levels on symbol change
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`levels_${selectedSymbol}`);
      setUserLevels(saved ? JSON.parse(saved) : []);
    } catch {
      setUserLevels([]);
    }
  }, [selectedSymbol]);

  // Initialize Lightweight Chart with sleek modern Bybit dark theme
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      layout: {
        background: { color: '#0B0E14' }, // Deep modern slate obsidian
        textColor: '#8C96A8',
        fontSize: 11,
        fontFamily: 'Inter, system-ui, sans-serif',
      },
      grid: {
        vertLines: { color: '#161B26' }, // Crisp high-tech grid
        horzLines: { color: '#161B26' },
      },
      crosshair: {
        mode: 1, // Normal
        vertLine: {
          color: '#3B465C',
          width: 1,
          style: 3, // Dashed
          labelBackgroundColor: '#1C2230',
        },
        horzLine: {
          color: '#3B465C',
          width: 1,
          style: 3,
          labelBackgroundColor: '#1C2230',
        },
      },
      timeScale: {
        borderColor: '#222938',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: '#222938',
        scaleMargins: {
          top: 0.08,
          bottom: 0.22,
        },
      },
    });

    // Candlestick Series (Neon emerald & punchy crimson)
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#0ECB81',
      downColor: '#F6465D',
      borderUpColor: '#0ECB81',
      borderDownColor: '#F6465D',
      wickUpColor: '#0ECB81',
      wickDownColor: '#F6465D',
    });

    // Volume Series
    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });

    chart.priceScale('volume').applyOptions({
      scaleMargins: {
        top: 0.82,
        bottom: 0,
      },
    });

    // EMA 20 & SMA 50 Line Series
    const ema20Series = chart.addLineSeries({
      color: '#00D8F6', // Neon cyan
      lineWidth: 2,
      title: 'EMA 20',
      priceScaleId: 'right',
    });

    const sma50Series = chart.addLineSeries({
      color: '#F0B90B', // Amber gold
      lineWidth: 2,
      title: 'SMA 50',
      priceScaleId: 'right',
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    ema20SeriesRef.current = ema20Series;
    sma50SeriesRef.current = sma50Series;

    // Resize Observer
    const handleResize = () => {
      if (containerRef.current && chart) {
        chart.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener('resize', handleResize);
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  // Calculate Technical Indicators (EMA 20, SMA 50)
  const { ema20Data, sma50Data } = useMemo(() => {
    if (!klines || klines.length === 0) return { ema20Data: [], sma50Data: [] };

    // SMA 50
    const sma: LineData[] = [];
    for (let i = 49; i < klines.length; i++) {
      let sum = 0;
      for (let j = 0; j < 50; j++) {
        sum += Number(klines[i - j].close);
      }
      sma.push({
        time: klines[i].time as UTCTimestamp,
        value: sum / 50,
      });
    }

    // EMA 20
    const ema: LineData[] = [];
    const k = 2 / (20 + 1);
    if (klines.length >= 20) {
      let sum = 0;
      for (let i = 0; i < 20; i++) sum += Number(klines[i].close);
      let currentEma = sum / 20;
      ema.push({ time: klines[19].time as UTCTimestamp, value: currentEma });

      for (let i = 20; i < klines.length; i++) {
        currentEma = Number(klines[i].close) * k + currentEma * (1 - k);
        ema.push({ time: klines[i].time as UTCTimestamp, value: currentEma });
      }
    }

    return { ema20Data: ema, sma50Data: sma };
  }, [klines]);

  // Set historical kline & indicator data
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current || klines.length === 0)
      return;

    const candleData: CandlestickData[] = klines.map((k) => ({
      time: k.time as UTCTimestamp,
      open: Number(k.open),
      high: Number(k.high),
      low: Number(k.low),
      close: Number(k.close),
    }));

    const volumeData: HistogramData[] = klines.map((k) => ({
      time: k.time as UTCTimestamp,
      value: Number(k.volume),
      color: k.close >= k.open ? 'rgba(14, 203, 129, 0.35)' : 'rgba(246, 70, 93, 0.35)',
    }));

    candleSeriesRef.current.setData(candleData);

    if (showVolume) {
      volumeSeriesRef.current.setData(volumeData);
    } else {
      volumeSeriesRef.current.setData([]);
    }

    if (showEma && ema20SeriesRef.current && sma50SeriesRef.current) {
      ema20SeriesRef.current.setData(ema20Data);
      sma50SeriesRef.current.setData(sma50Data);
    } else if (ema20SeriesRef.current && sma50SeriesRef.current) {
      ema20SeriesRef.current.setData([]);
      sma50SeriesRef.current.setData([]);
    }

    chartRef.current?.timeScale().fitContent();
  }, [klines, showVolume, showEma, ema20Data, sma50Data]);

  // Live update of current candle from ticker ticks
  useEffect(() => {
    const t = tickers[selectedSymbol];
    if (!t || !candleSeriesRef.current || klines.length === 0) return;

    const lastKline = klines[klines.length - 1];
    if (!lastKline) return;

    const price = Number(t.lastPrice);
    const updatedCandle: CandlestickData = {
      time: lastKline.time as UTCTimestamp,
      open: Number(lastKline.open),
      high: Math.max(Number(lastKline.high), price),
      low: Math.min(Number(lastKline.low), price),
      close: price,
    };

    candleSeriesRef.current.update(updatedCandle);
  }, [tickers, selectedSymbol]);

  // Synchronize All Horizontal Price Lines (Support / Resistance / Fibo / Orders / Positions)
  useEffect(() => {
    if (!candleSeriesRef.current) return;

    // Remove old lines
    priceLinesRef.current.forEach((line) => {
      try {
        candleSeriesRef.current?.removePriceLine(line);
      } catch {}
    });
    priceLinesRef.current.clear();

    // 1. Draw Active Positions Lines
    const activePositions = positions.filter((p) => p.symbol === selectedSymbol);
    activePositions.forEach((pos) => {
      const entryLine = candleSeriesRef.current?.createPriceLine({
        price: Number(pos.entryPrice),
        color: '#F0B90B',
        lineWidth: 2,
        lineStyle: 2, // Dashed
        axisLabelVisible: true,
        title: `Entry (${pos.direction} ${pos.leverage}x)`,
      });
      if (entryLine) priceLinesRef.current.set(`pos_entry_${pos.id}`, entryLine);

      if (pos.liquidationPrice > 0) {
        const liqLine = candleSeriesRef.current?.createPriceLine({
          price: Number(pos.liquidationPrice),
          color: '#F6465D',
          lineWidth: 2,
          lineStyle: 3, // Dotted
          axisLabelVisible: true,
          title: `Liq Price`,
        });
        if (liqLine) priceLinesRef.current.set(`pos_liq_${pos.id}`, liqLine);
      }
    });

    // 2. Draw Active Open Orders Lines
    const activeOrders = openOrders.filter((o) => o.symbol === selectedSymbol && o.price);
    activeOrders.forEach((ord) => {
      const ordLine = candleSeriesRef.current?.createPriceLine({
        price: Number(ord.price),
        color: ord.side === 'Buy' ? '#0ECB81' : '#F6465D',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: `${ord.side} Limit`,
      });
      if (ordLine) priceLinesRef.current.set(`ord_${ord.id}`, ordLine);
    });

    // 3. Draw User Custom Support & Resistance Lines
    userLevels.forEach((level) => {
      const lvlLine = candleSeriesRef.current?.createPriceLine({
        price: level.price,
        color: level.color,
        lineWidth: 2,
        lineStyle: level.type === 'support' ? 0 : 2, // Solid for support, dashed for resistance
        axisLabelVisible: true,
        title: level.title,
      });
      if (lvlLine) priceLinesRef.current.set(`user_lvl_${level.id}`, lvlLine);
    });

    // 4. Auto Fibonacci Retracement Levels
    if (showFibo && ticker && ticker.high24h > ticker.low24h) {
      const high = Number(ticker.high24h);
      const low = Number(ticker.low24h);
      const diff = high - low;

      const fibRatios = [
        { ratio: 0, title: 'Fib 0.0 (High)', color: '#9B51E0' },
        { ratio: 0.236, title: 'Fib 0.236', color: '#00D8F6' },
        { ratio: 0.382, title: 'Fib 0.382', color: '#F0B90B' },
        { ratio: 0.5, title: 'Fib 0.50 (Mid)', color: '#FFFFFF' },
        { ratio: 0.618, title: 'Fib 0.618 (Golden)', color: '#0ECB81' },
        { ratio: 0.786, title: 'Fib 0.786', color: '#00D8F6' },
        { ratio: 1.0, title: 'Fib 1.0 (Low)', color: '#F6465D' },
      ];

      fibRatios.forEach((fib, idx) => {
        const fibPrice = high - diff * fib.ratio;
        const fLine = candleSeriesRef.current?.createPriceLine({
          price: fibPrice,
          color: fib.color,
          lineWidth: fib.ratio === 0.618 ? 2 : 1,
          lineStyle: 3,
          axisLabelVisible: true,
          title: fib.title,
        });
        if (fLine) priceLinesRef.current.set(`fib_${idx}`, fLine);
      });
    }
  }, [positions, openOrders, userLevels, showFibo, selectedSymbol, ticker]);

  // Quick action: Add Support at current price - 1%
  const handleAddSupport = () => {
    if (currentPrice <= 0) return;
    const price = Math.round(currentPrice * 0.985 * 100) / 100;
    const newLvl: CustomLevel = {
      id: Date.now().toString(),
      price,
      type: 'support',
      color: '#0ECB81',
      title: `Support $${price}`,
    };
    setUserLevels((prev) => [...prev, newLvl]);
  };

  // Quick action: Add Resistance at current price + 1.5%
  const handleAddResistance = () => {
    if (currentPrice <= 0) return;
    const price = Math.round(currentPrice * 1.015 * 100) / 100;
    const newLvl: CustomLevel = {
      id: Date.now().toString(),
      price,
      type: 'resistance',
      color: '#F6465D',
      title: `Resistance $${price}`,
    };
    setUserLevels((prev) => [...prev, newLvl]);
  };

  // Manual Add Level Confirm
  const handleConfirmCustomLevel = () => {
    const p = Number(newLevelPrice);
    if (p <= 0) return;
    const color =
      newLevelType === 'support'
        ? '#0ECB81'
        : newLevelType === 'resistance'
        ? '#F6465D'
        : '#F0B90B';
    const newLvl: CustomLevel = {
      id: Date.now().toString(),
      price: p,
      type: newLevelType,
      color,
      title: `${newLevelType.toUpperCase()} $${p}`,
    };
    setUserLevels((prev) => [...prev, newLvl]);
    setNewLevelPrice('');
    setShowAddLevelModal(false);
  };

  // Clear all user levels
  const handleClearLevels = () => {
    setUserLevels([]);
    localStorage.removeItem(`levels_${selectedSymbol}`);
  };

  // Remove single level
  const handleRemoveLevel = (id: string) => {
    setUserLevels((prev) => prev.filter((l) => l.id !== id));
  };

  return (
    <div className="flex flex-col h-full bg-bg-primary select-none w-full">
      {/* Top Professional Toolbar */}
      <div className="flex flex-wrap items-center justify-between px-3 py-1.5 bg-bg-secondary border-b border-border text-xs gap-2">
        {/* Timeframes */}
        <div className="flex items-center space-x-1">
          <span className="text-text-muted mr-1.5 font-medium text-[11px]">Time:</span>
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              onClick={() => setKlineInterval(tf.value)}
              className={`px-2 py-0.5 rounded text-xs font-semibold transition-all ${
                klineInterval === tf.value
                  ? 'bg-bg-panel text-accent-gold border border-accent-gold/40 shadow-sm'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>

        {/* Technical Drawing & Indicator Controls */}
        <div className="flex items-center space-x-2">
          {/* Quick Support Line Button */}
          <button
            onClick={handleAddSupport}
            className="flex items-center space-x-1 px-2.5 py-1 rounded bg-trade-buy/15 hover:bg-trade-buy/25 text-trade-buy border border-trade-buy/30 font-semibold text-[11px] transition-all"
            title="Add Support Level line"
          >
            <Minus className="w-3.5 h-3.5 text-trade-buy stroke-[3]" />
            <span>+ Support</span>
          </button>

          {/* Quick Resistance Line Button */}
          <button
            onClick={handleAddResistance}
            className="flex items-center space-x-1 px-2.5 py-1 rounded bg-trade-sell/15 hover:bg-trade-sell/25 text-trade-sell border border-trade-sell/30 font-semibold text-[11px] transition-all"
            title="Add Resistance Level line"
          >
            <Minus className="w-3.5 h-3.5 text-trade-sell stroke-[3]" />
            <span>+ Resistance</span>
          </button>

          {/* Fibonacci Auto Calculator */}
          <button
            onClick={() => setShowFibo(!showFibo)}
            className={`flex items-center space-x-1 px-2 py-1 rounded font-semibold text-[11px] transition-all ${
              showFibo
                ? 'bg-accent-gold/20 text-accent-gold border border-accent-gold/50 shadow-sm'
                : 'bg-bg-card hover:bg-bg-hover text-text-secondary border border-border'
            }`}
            title="Toggle Fibonacci Retracement"
          >
            <Percent className="w-3.5 h-3.5" />
            <span>Fib Levels</span>
          </button>

          {/* Indicators Toggle (EMA 20 & SMA 50) */}
          <button
            onClick={() => setShowEma(!showEma)}
            className={`flex items-center space-x-1 px-2 py-1 rounded font-semibold text-[11px] transition-all ${
              showEma
                ? 'bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/40 shadow-sm'
                : 'bg-bg-card hover:bg-bg-hover text-text-secondary border border-border'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>EMA/SMA</span>
          </button>

          {/* Volume toggle */}
          <button
            onClick={() => setShowVolume(!showVolume)}
            className={`flex items-center space-x-1 px-2 py-1 rounded font-semibold text-[11px] transition-all ${
              showVolume
                ? 'bg-bg-panel text-text-primary border border-border shadow-sm'
                : 'bg-bg-card hover:bg-bg-hover text-text-muted border border-border'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Vol</span>
          </button>

          {/* Custom Level by exact price */}
          <button
            onClick={() => setShowAddLevelModal(true)}
            className="flex items-center space-x-1 px-2 py-1 rounded bg-bg-card hover:bg-bg-hover text-text-secondary border border-border font-semibold text-[11px] transition-all"
            title="Add custom price level"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Set Level</span>
          </button>

          {/* Clear all user levels */}
          {userLevels.length > 0 && (
            <button
              onClick={handleClearLevels}
              className="p-1 rounded bg-bg-card hover:bg-trade-sell/20 text-text-muted hover:text-trade-sell border border-border transition-all"
              title="Clear all drawn levels"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Active Drawings Chips Strip (if user created any) */}
      {userLevels.length > 0 && (
        <div className="flex items-center space-x-2 px-3 py-1 bg-bg-card border-b border-border overflow-x-auto text-[10px]">
          <span className="text-text-muted uppercase font-bold shrink-0">Levels:</span>
          {userLevels.map((lvl) => (
            <div
              key={lvl.id}
              className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-bg-panel border border-border shrink-0 tabular-nums font-semibold"
              style={{ color: lvl.color }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: lvl.color }} />
              <span>{lvl.title}</span>
              <button
                onClick={() => handleRemoveLevel(lvl.id)}
                className="hover:text-trade-sell ml-1"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Lightweight Chart Canvas Area */}
      <div ref={containerRef} className="flex-1 w-full relative min-h-[300px]" />

      {/* Modal for setting custom level */}
      {showAddLevelModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-bg-card border border-border rounded-xl w-full max-w-xs p-4 shadow-2xl">
            <h3 className="font-bold text-sm text-text-primary mb-3">Add Chart Level</h3>
            <div className="space-y-3 mb-4 text-xs">
              <div>
                <label className="block text-text-muted mb-1 font-medium">Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewLevelType('support')}
                    className={`py-1 rounded font-bold transition-all ${
                      newLevelType === 'support'
                        ? 'bg-trade-buy text-white'
                        : 'bg-bg-panel text-text-secondary border border-border'
                    }`}
                  >
                    Support Line
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewLevelType('resistance')}
                    className={`py-1 rounded font-bold transition-all ${
                      newLevelType === 'resistance'
                        ? 'bg-trade-sell text-white'
                        : 'bg-bg-panel text-text-secondary border border-border'
                    }`}
                  >
                    Resistance Line
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-text-muted mb-1 font-medium">Target Price (USDT)</label>
                <input
                  type="number"
                  step="any"
                  value={newLevelPrice}
                  onChange={(e) => setNewLevelPrice(e.target.value)}
                  placeholder={`e.g. ${currentPrice || 500}`}
                  className="w-full bg-bg-panel border border-border rounded px-2.5 py-1.5 text-text-primary tabular-nums focus:outline-none focus:border-accent-gold"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setShowAddLevelModal(false)}
                className="flex-1 py-1.5 rounded bg-bg-panel hover:bg-bg-hover text-text-secondary font-medium border border-border text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmCustomLevel}
                className="flex-1 py-1.5 rounded bg-accent-gold hover:bg-accent-gold-hover text-bg-primary font-bold text-xs shadow"
              >
                Plot Level
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
