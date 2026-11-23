import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
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
import { formatPrice } from '../../utils/formatters';
import {
  TrendingUp,
  Minus,
  Trash2,
  BarChart2,
  Percent,
  MoveVertical,
  ChevronDown,
} from 'lucide-react';

const TIMEFRAMES = [
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '1h', value: '1h' },
  { label: '4h', value: '4h' },
  { label: '1D', value: '1d' },
];

const PRESET_COLORS = [
  { label: 'Emerald', value: '#0ECB81' },
  { label: 'Red', value: '#F6465D' },
  { label: 'Gold', value: '#F0B90B' },
  { label: 'Cyan', value: '#00D8F6' },
  { label: 'White', value: '#FFFFFF' },
];

interface UserLine {
  id: string;
  price: number;
  color: string;
  label: string;
}

interface FiboState {
  highPrice: number;
  lowPrice: number;
}

export const TradingChart: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const ema20SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const sma50SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  // Map of native price line objects
  const priceLinesMap = useRef<Map<string, IPriceLine>>(new Map());

  const { selectedSymbol, klines, klineInterval, setKlineInterval, tickers } =
    useMarketStore();
  const { positions, openOrders } = useTradeStore();

  const ticker = tickers[selectedSymbol];
  const currentPrice = ticker?.lastPrice ?? 0;

  // Indicators toggle
  const [showEma, setShowEma] = useState(true);
  const [showVolume, setShowVolume] = useState(true);

  // User-drawn lines
  const [lines, setLines] = useState<UserLine[]>(() => {
    try {
      const saved = localStorage.getItem(`user_lines_${selectedSymbol}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Fibonacci Retracement state
  const [fibo, setFibo] = useState<FiboState | null>(() => {
    try {
      const saved = localStorage.getItem(`fibo_${selectedSymbol}`);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Active color for new lines
  const [activeColor, setActiveColor] = useState<string>('#0ECB81');
  const [showLinesDrawer, setShowLinesDrawer] = useState<boolean>(false);

  // Dragging state
  const [dragState, setDragState] = useState<{
    target: 'line' | 'fibo-high' | 'fibo-low';
    lineId?: string;
  } | null>(null);

  // Crosshair / Hover price
  const [cursorPrice, setCursorPrice] = useState<number | null>(null);

  // Save lines to localStorage
  useEffect(() => {
    localStorage.setItem(`user_lines_${selectedSymbol}`, JSON.stringify(lines));
  }, [lines, selectedSymbol]);

  // Save fibo to localStorage
  useEffect(() => {
    if (fibo) {
      localStorage.setItem(`fibo_${selectedSymbol}`, JSON.stringify(fibo));
    } else {
      localStorage.removeItem(`fibo_${selectedSymbol}`);
    }
  }, [fibo, selectedSymbol]);

  // Load on symbol change
  useEffect(() => {
    try {
      const savedLines = localStorage.getItem(`user_lines_${selectedSymbol}`);
      setLines(savedLines ? JSON.parse(savedLines) : []);
      const savedFibo = localStorage.getItem(`fibo_${selectedSymbol}`);
      setFibo(savedFibo ? JSON.parse(savedFibo) : null);
    } catch {
      setLines([]);
      setFibo(null);
    }
  }, [selectedSymbol]);

  // Initialize Lightweight Chart
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      layout: {
        background: { color: '#0E1117' },
        textColor: '#929AA5',
        fontSize: 11,
        fontFamily: 'Inter, system-ui, sans-serif',
      },
      grid: {
        vertLines: { color: '#1A1D28' },
        horzLines: { color: '#1A1D28' },
      },
      crosshair: {
        mode: 1, // Normal
        vertLine: {
          color: '#3B465C',
          width: 1,
          style: 3,
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

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#0ECB81',
      downColor: '#F6465D',
      borderUpColor: '#0ECB81',
      borderDownColor: '#F6465D',
      wickUpColor: '#0ECB81',
      wickDownColor: '#F6465D',
    });

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

    const ema20Series = chart.addLineSeries({
      color: '#00D8F6',
      lineWidth: 2,
      title: 'EMA 20',
      priceScaleId: 'right',
    });

    const sma50Series = chart.addLineSeries({
      color: '#F0B90B',
      lineWidth: 2,
      title: 'SMA 50',
      priceScaleId: 'right',
    });

    // Track crosshair price
    chart.subscribeCrosshairMove((param) => {
      if (param.point && candleSeries) {
        const p = candleSeries.coordinateToPrice(param.point.y);
        if (p !== null) {
          setCursorPrice(Number(p));
        }
      }
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    ema20SeriesRef.current = ema20Series;
    sma50SeriesRef.current = sma50Series;

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

  // Compute EMA 20 & SMA 50
  const { ema20Data, sma50Data } = useMemo(() => {
    if (!klines || klines.length === 0) return { ema20Data: [], sma50Data: [] };

    const sma: LineData[] = [];
    for (let i = 49; i < klines.length; i++) {
      let sum = 0;
      for (let j = 0; j < 50; j++) sum += Number(klines[i - j].close);
      sma.push({ time: klines[i].time as UTCTimestamp, value: sum / 50 });
    }

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

  // Set historical kline data
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

  // Live ticker tick update
  useEffect(() => {
    const t = tickers[selectedSymbol];
    if (!t || !candleSeriesRef.current || klines.length === 0) return;

    const lastKline = klines[klines.length - 1];
    if (!lastKline) return;

    const p = Number(t.lastPrice);
    const updatedCandle: CandlestickData = {
      time: lastKline.time as UTCTimestamp,
      open: Number(lastKline.open),
      high: Math.max(Number(lastKline.high), p),
      low: Math.min(Number(lastKline.low), p),
      close: p,
    };

    candleSeriesRef.current.update(updatedCandle);
  }, [tickers, selectedSymbol]);

  // Synchronize all native price lines
  useEffect(() => {
    if (!candleSeriesRef.current) return;

    // Clear old lines
    priceLinesMap.current.forEach((line) => {
      try {
        candleSeriesRef.current?.removePriceLine(line);
      } catch {}
    });
    priceLinesMap.current.clear();

    // 1. Open Positions
    positions
      .filter((p) => p.symbol === selectedSymbol)
      .forEach((pos) => {
        const entryLine = candleSeriesRef.current?.createPriceLine({
          price: Number(pos.entryPrice),
          color: '#F0B90B',
          lineWidth: 2,
          lineStyle: 2,
          axisLabelVisible: true,
          title: `Entry (${pos.direction} ${pos.leverage}x)`,
        });
        if (entryLine) priceLinesMap.current.set(`pos_${pos.id}`, entryLine);

        if (pos.liquidationPrice > 0) {
          const liqLine = candleSeriesRef.current?.createPriceLine({
            price: Number(pos.liquidationPrice),
            color: '#F6465D',
            lineWidth: 2,
            lineStyle: 3,
            axisLabelVisible: true,
            title: `Liq Price`,
          });
          if (liqLine) priceLinesMap.current.set(`liq_${pos.id}`, liqLine);
        }
      });

    // 2. Open Orders
    openOrders
      .filter((o) => o.symbol === selectedSymbol && o.price)
      .forEach((ord) => {
        const ordLine = candleSeriesRef.current?.createPriceLine({
          price: Number(ord.price),
          color: ord.side === 'Buy' ? '#0ECB81' : '#F6465D',
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: `${ord.side} Limit`,
        });
        if (ordLine) priceLinesMap.current.set(`ord_${ord.id}`, ordLine);
      });

    // 3. User-created Lines (Horizontal lines)
    lines.forEach((l) => {
      const lineObj = candleSeriesRef.current?.createPriceLine({
        price: l.price,
        color: l.color,
        lineWidth: 2,
        lineStyle: 0, // Solid
        axisLabelVisible: true,
        title: `$${formatPrice(l.price)}`,
      });
      if (lineObj) priceLinesMap.current.set(`line_${l.id}`, lineObj);
    });

    // 4. Fibonacci Retracement Levels
    if (fibo) {
      const diff = fibo.highPrice - fibo.lowPrice;
      const fibLevels = [
        { ratio: 0.0, label: 'Fib 0.00 (High)', color: '#9B51E0' },
        { ratio: 0.236, label: 'Fib 0.236', color: '#00D8F6' },
        { ratio: 0.382, label: 'Fib 0.382', color: '#F0B90B' },
        { ratio: 0.5, label: 'Fib 0.500', color: '#FFFFFF' },
        { ratio: 0.618, label: 'Fib 0.618 (Golden)', color: '#0ECB81' },
        { ratio: 0.786, label: 'Fib 0.786', color: '#00D8F6' },
        { ratio: 1.0, label: 'Fib 1.00 (Low)', color: '#F6465D' },
      ];

      fibLevels.forEach((fl, idx) => {
        const p = fibo.highPrice - diff * fl.ratio;
        const fLine = candleSeriesRef.current?.createPriceLine({
          price: p,
          color: fl.color,
          lineWidth: fl.ratio === 0.618 ? 2 : 1,
          lineStyle: 3, // Dotted
          axisLabelVisible: true,
          title: `${fl.label} $${formatPrice(p)}`,
        });
        if (fLine) priceLinesMap.current.set(`fib_${idx}`, fLine);
      });
    }
  }, [positions, openOrders, lines, fibo, selectedSymbol]);

  // Add a new horizontal line at current cursor or price
  const handleAddLine = () => {
    const targetPrice = cursorPrice && cursorPrice > 0 ? cursorPrice : currentPrice;
    if (targetPrice <= 0) return;

    const newLine: UserLine = {
      id: Date.now().toString(),
      price: Math.round(targetPrice * 100) / 100,
      color: activeColor,
      label: `Линия ${lines.length + 1}`,
    };
    setLines((prev) => [...prev, newLine]);
    setShowLinesDrawer(true);
  };

  // Toggle Fibonacci Retracement
  const handleToggleFibo = () => {
    if (fibo) {
      setFibo(null);
    } else {
      // Default to 24h high/low or reasonable spread
      const high = ticker?.high24h && ticker.high24h > currentPrice
        ? Number(ticker.high24h)
        : currentPrice * 1.03;
      const low = ticker?.low24h && ticker.low24h < currentPrice
        ? Number(ticker.low24h)
        : currentPrice * 0.97;
      setFibo({ highPrice: Math.round(high * 100) / 100, lowPrice: Math.round(low * 100) / 100 });
      setShowLinesDrawer(true);
    }
  };

  // Window-level dragging event listeners for ultra-smooth drag anywhere on screen
  useEffect(() => {
    if (!dragState) return;

    const onWindowMove = (e: MouseEvent) => {
      if (!containerRef.current || !candleSeriesRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const mouseY = e.clientY - rect.top;
      const newPrice = candleSeriesRef.current.coordinateToPrice(mouseY);
      if (newPrice === null || newPrice <= 0) return;

      const roundedPrice = Math.round(Number(newPrice) * 100) / 100;

      if (dragState.target === 'line' && dragState.lineId) {
        setLines((prev) =>
          prev.map((l) =>
            l.id === dragState.lineId ? { ...l, price: roundedPrice } : l
          )
        );
      } else if (dragState.target === 'fibo-high') {
        setFibo((prev) => (prev ? { ...prev, highPrice: roundedPrice } : null));
      } else if (dragState.target === 'fibo-low') {
        setFibo((prev) => (prev ? { ...prev, lowPrice: roundedPrice } : null));
      }
    };

    const onWindowUp = () => {
      setDragState(null);
    };

    window.addEventListener('mousemove', onWindowMove);
    window.addEventListener('mouseup', onWindowUp);
    return () => {
      window.removeEventListener('mousemove', onWindowMove);
      window.removeEventListener('mouseup', onWindowUp);
    };
  }, [dragState]);

  // Dragging event handlers
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!dragState || !containerRef.current || !candleSeriesRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const mouseY = e.clientY - rect.top;
      const newPrice = candleSeriesRef.current.coordinateToPrice(mouseY);
      if (newPrice === null || newPrice <= 0) return;

      const roundedPrice = Math.round(Number(newPrice) * 100) / 100;

      if (dragState.target === 'line' && dragState.lineId) {
        setLines((prev) =>
          prev.map((l) =>
            l.id === dragState.lineId ? { ...l, price: roundedPrice } : l
          )
        );
      } else if (dragState.target === 'fibo-high') {
        setFibo((prev) => (prev ? { ...prev, highPrice: roundedPrice } : null));
      } else if (dragState.target === 'fibo-low') {
        setFibo((prev) => (prev ? { ...prev, lowPrice: roundedPrice } : null));
      }
    },
    [dragState]
  );

  const handleMouseUp = () => {
    setDragState(null);
  };

  // Fine tune line price
  const updateLinePrice = (id: string, delta: number) => {
    setLines((prev) =>
      prev.map((l) => (l.id === id ? { ...l, price: Math.round((l.price + delta) * 100) / 100 } : l))
    );
  };

  const setLinePriceDirect = (id: string, price: number) => {
    if (price <= 0 || isNaN(price)) return;
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, price } : l)));
  };

  const removeLine = (id: string) => {
    setLines((prev) => prev.filter((l) => l.id !== id));
  };

  const clearAllLines = () => {
    setLines([]);
    setFibo(null);
    localStorage.removeItem(`user_lines_${selectedSymbol}`);
    localStorage.removeItem(`fibo_${selectedSymbol}`);
  };

  return (
    <div
      className="flex flex-col h-full bg-bg-primary select-none w-full relative"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Top Pro Toolbar */}
      <div className="flex flex-wrap items-center justify-between px-3 py-1.5 bg-bg-secondary border-b border-border text-xs gap-2 z-20">
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

        {/* Drawing & Analysis Tools */}
        <div className="flex items-center space-x-2">
          {/* Add Horizontal Line Tool */}
          <button
            onClick={handleAddLine}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-bg-card hover:bg-bg-hover text-text-primary border border-border font-semibold text-[11px] transition-all shadow-sm"
            title="Добавить горизонтальную линию (тяните мышкой)"
          >
            <Minus className="w-3.5 h-3.5 stroke-[3]" style={{ color: activeColor }} />
            <span>+ Линия</span>
          </button>

          {/* Color selector for lines */}
          <div className="flex items-center space-x-1 bg-bg-card p-0.5 rounded border border-border">
            {PRESET_COLORS.map((c) => (
              <button
                key={c.value}
                onClick={() => setActiveColor(c.value)}
                className={`w-3.5 h-3.5 rounded-full transition-transform ${
                  activeColor === c.value
                    ? 'ring-2 ring-white scale-110 shadow-sm'
                    : 'opacity-60 hover:opacity-100'
                }`}
                style={{ backgroundColor: c.value }}
                title={c.label}
              />
            ))}
          </div>

          {/* Fibonacci Tool */}
          <button
            onClick={handleToggleFibo}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded font-semibold text-[11px] transition-all ${
              fibo
                ? 'bg-accent-gold/20 text-accent-gold border border-accent-gold/50 shadow-sm'
                : 'bg-bg-card hover:bg-bg-hover text-text-secondary border border-border'
            }`}
            title="Включить сетку Фибоначчи (можно двигать верх и низ мышкой)"
          >
            <Percent className="w-3.5 h-3.5" />
            <span>Фибоначчи</span>
          </button>

          {/* Active Lines Drawer Toggle */}
          <button
            onClick={() => setShowLinesDrawer(!showLinesDrawer)}
            className={`flex items-center space-x-1 px-2 py-1 rounded font-semibold text-[11px] transition-all ${
              lines.length > 0 || fibo
                ? 'bg-bg-panel text-accent-gold border border-border'
                : 'bg-bg-card text-text-muted hover:text-text-primary border border-border'
            }`}
            title="Управление созданными линиями"
          >
            <MoveVertical className="w-3.5 h-3.5" />
            <span>Линии ({lines.length + (fibo ? 1 : 0)})</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${showLinesDrawer ? 'rotate-180' : ''}`} />
          </button>

          {/* Indicators Toggle */}
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

          {/* Clear all */}
          {(lines.length > 0 || fibo) && (
            <button
              onClick={clearAllLines}
              className="p-1 rounded bg-bg-card hover:bg-trade-sell/20 text-text-muted hover:text-trade-sell border border-border transition-all"
              title="Очистить все линии и Фибоначчи"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Interactive Active Lines & Fibonacci Controller Drawer */}
      {showLinesDrawer && (
        <div className="absolute top-10 right-4 z-30 w-80 bg-bg-card border border-border rounded-xl p-3 shadow-2xl space-y-2 text-xs">
          <div className="flex justify-between items-center pb-2 border-b border-border">
            <span className="font-bold text-text-primary text-[11px] uppercase tracking-wide">
              Управление линиями графика
            </span>
            <span className="text-[10px] text-text-muted">Тяните ползунки или мышь</span>
          </div>

          <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
            {/* Horizontal Lines Controls */}
            {lines.map((l) => (
              <div
                key={l.id}
                className="p-2.5 rounded-lg bg-bg-panel border border-border flex flex-col space-y-2 shadow-sm"
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-1.5 font-semibold text-text-primary">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                      style={{ backgroundColor: l.color }}
                    />
                    <span>{l.label}</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <button
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setDragState({ target: 'line', lineId: l.id });
                      }}
                      className="px-2.5 py-1 rounded bg-accent-gold/20 hover:bg-accent-gold/30 text-accent-gold font-bold text-[11px] cursor-ns-resize transition-colors flex items-center space-x-1 shadow-sm"
                      title="Зажмите и тяните мышь вверх/вниз в любое место экрана"
                    >
                      <MoveVertical className="w-3 h-3" />
                      <span>Двигать мышью</span>
                    </button>
                    <button
                      onClick={() => removeLine(l.id)}
                      className="text-text-muted hover:text-trade-sell p-1 rounded hover:bg-bg-hover transition-colors font-bold text-sm"
                      title="Удалить линию"
                    >
                      ×
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs tabular-nums gap-2">
                  <div className="flex items-center space-x-1 bg-bg-card border border-border rounded px-2 py-1">
                    <span className="text-text-muted text-[10px]">$</span>
                    <input
                      type="number"
                      step="any"
                      value={l.price}
                      onChange={(e) => setLinePriceDirect(l.id, parseFloat(e.target.value) || 0)}
                      className="w-20 bg-transparent text-text-primary font-mono font-bold text-xs focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => updateLinePrice(l.id, -10)}
                      className="px-1.5 py-0.5 rounded bg-bg-card hover:bg-bg-hover border border-border text-text-muted hover:text-text-primary text-[10px]"
                    >
                      -10
                    </button>
                    <button
                      onClick={() => updateLinePrice(l.id, -1)}
                      className="px-1.5 py-0.5 rounded bg-bg-card hover:bg-bg-hover border border-border text-text-secondary hover:text-text-primary text-[10px]"
                    >
                      -1
                    </button>
                    <button
                      onClick={() => updateLinePrice(l.id, 1)}
                      className="px-1.5 py-0.5 rounded bg-bg-card hover:bg-bg-hover border border-border text-text-secondary hover:text-text-primary text-[10px]"
                    >
                      +1
                    </button>
                    <button
                      onClick={() => updateLinePrice(l.id, 10)}
                      className="px-1.5 py-0.5 rounded bg-bg-card hover:bg-bg-hover border border-border text-text-muted hover:text-text-primary text-[10px]"
                    >
                      +10
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* Fibonacci Controls */}
            {fibo && (
              <div className="p-2.5 rounded-lg bg-bg-panel border border-accent-gold/40 flex flex-col space-y-2.5 shadow-sm">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-accent-gold text-[11px] uppercase tracking-wider flex items-center space-x-1">
                    <Percent className="w-3.5 h-3.5 mr-1" />
                    Сетка Фибоначчи
                  </span>
                  <button
                    onClick={() => setFibo(null)}
                    className="text-text-muted hover:text-trade-sell p-1 rounded hover:bg-bg-hover transition-colors font-bold text-sm"
                    title="Удалить Фибоначчи"
                  >
                    ×
                  </button>
                </div>

                {/* High Anchor */}
                <div className="flex justify-between items-center text-[11px] tabular-nums gap-2">
                  <div className="flex items-center space-x-1">
                    <span className="text-text-muted">Верх (100%):</span>
                    <div className="flex items-center space-x-1 bg-bg-card border border-border rounded px-1.5 py-0.5">
                      <span className="text-text-muted text-[10px]">$</span>
                      <input
                        type="number"
                        step="any"
                        value={fibo.highPrice}
                        onChange={(e) =>
                          setFibo((prev) =>
                            prev ? { ...prev, highPrice: parseFloat(e.target.value) || 0 } : null
                          )
                        }
                        className="w-18 bg-transparent text-text-primary font-mono font-bold text-xs focus:outline-none"
                      />
                    </div>
                  </div>
                  <button
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setDragState({ target: 'fibo-high' });
                    }}
                    className="px-2 py-1 rounded bg-accent-gold/20 hover:bg-accent-gold/30 text-accent-gold font-bold text-[10px] cursor-ns-resize transition-colors flex items-center space-x-0.5 shrink-0"
                    title="Зажмите и тяните мышь для перемещения верхнего уровня Фибоначчи"
                  >
                    <MoveVertical className="w-3 h-3" />
                    <span>Тянуть верх</span>
                  </button>
                </div>

                {/* Low Anchor */}
                <div className="flex justify-between items-center text-[11px] tabular-nums gap-2">
                  <div className="flex items-center space-x-1">
                    <span className="text-text-muted">Низ (0%):</span>
                    <div className="flex items-center space-x-1 bg-bg-card border border-border rounded px-1.5 py-0.5">
                      <span className="text-text-muted text-[10px]">$</span>
                      <input
                        type="number"
                        step="any"
                        value={fibo.lowPrice}
                        onChange={(e) =>
                          setFibo((prev) =>
                            prev ? { ...prev, lowPrice: parseFloat(e.target.value) || 0 } : null
                          )
                        }
                        className="w-18 bg-transparent text-text-primary font-mono font-bold text-xs focus:outline-none"
                      />
                    </div>
                  </div>
                  <button
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setDragState({ target: 'fibo-low' });
                    }}
                    className="px-2 py-1 rounded bg-accent-gold/20 hover:bg-accent-gold/30 text-accent-gold font-bold text-[10px] cursor-ns-resize transition-colors flex items-center space-x-0.5 shrink-0"
                    title="Зажмите и тяните мышь для перемещения нижнего уровня Фибоначчи"
                  >
                    <MoveVertical className="w-3 h-3" />
                    <span>Тянуть низ</span>
                  </button>
                </div>
              </div>
            )}

            {lines.length === 0 && !fibo && (
              <div className="text-center py-4 text-text-muted text-xs">
                Линии ещё не добавлены. Нажмите "+ Линия" или "Фибоначчи".
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lightweight Charts Canvas Element */}
      <div ref={containerRef} className="flex-1 w-full relative min-h-[350px]" />
    </div>
  );
};
