import React, { useEffect, useRef, useState } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  HistogramData,
  UTCTimestamp,
} from 'lightweight-charts';
import { useMarketStore } from '../../store/useMarketStore';
import { useTradeStore } from '../../store/useTradeStore';

const TIMEFRAMES = [
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '1h', value: '1h' },
  { label: '4h', value: '4h' },
  { label: '1D', value: '1d' },
];

export const TradingChart: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  const { selectedSymbol, klines, klineInterval, setKlineInterval, tickers } =
    useMarketStore();
  const { positions, openOrders } = useTradeStore();

  const [showMa, setShowMa] = useState(true);

  // Initialize Lightweight Chart
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      layout: {
        background: { color: '#0B0E11' },
        textColor: '#7B8494',
        fontSize: 11,
        fontFamily: 'Inter, system-ui, sans-serif',
      },
      grid: {
        vertLines: { color: '#161A22' },
        horzLines: { color: '#161A22' },
      },
      crosshair: {
        mode: 1, // CrosshairMode.Normal
        vertLine: {
          color: '#2d3542',
          width: 1,
          style: 3, // LineStyle.Dashed
        },
        horzLine: {
          color: '#2d3542',
          width: 1,
          style: 3,
        },
      },
      timeScale: {
        borderColor: '#1E232B',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: '#1E232B',
        scaleMargins: {
          top: 0.1,
          bottom: 0.25,
        },
      },
    });

    // Candlestick Series
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
        top: 0.8,
        bottom: 0,
      },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    // Responsive resize
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
      color: k.close >= k.open ? 'rgba(14, 203, 129, 0.3)' : 'rgba(246, 70, 93, 0.3)',
    }));

    candleSeriesRef.current.setData(candleData);
    volumeSeriesRef.current.setData(volumeData);
    chartRef.current?.timeScale().fitContent();
  }, [klines]);

  // Live update of current candle from ticker ticks
  useEffect(() => {
    const ticker = tickers[selectedSymbol];
    if (!ticker || !candleSeriesRef.current || klines.length === 0) return;

    const lastKline = klines[klines.length - 1];
    if (!lastKline) return;

    const price = Number(ticker.lastPrice);
    const updatedCandle: CandlestickData = {
      time: lastKline.time as UTCTimestamp,
      open: Number(lastKline.open),
      high: Math.max(Number(lastKline.high), price),
      low: Math.min(Number(lastKline.low), price),
      close: price,
    };

    candleSeriesRef.current.update(updatedCandle);
  }, [tickers, selectedSymbol]);

  // Horizontal price lines for open positions and orders
  useEffect(() => {
    if (!candleSeriesRef.current) return;

    // Filter for current symbol
    const activePositions = positions.filter((p) => p.symbol === selectedSymbol);
    const activeOrders = openOrders.filter((o) => o.symbol === selectedSymbol && o.price);

    // Render price lines
    activePositions.forEach((pos) => {
      candleSeriesRef.current?.createPriceLine({
        price: Number(pos.entryPrice),
        color: '#F0B90B',
        lineWidth: 1,
        lineStyle: 2, // Dashed
        axisLabelVisible: true,
        title: `Entry (${pos.direction} ${pos.leverage}x)`,
      });

      if (pos.liquidationPrice > 0) {
        candleSeriesRef.current?.createPriceLine({
          price: Number(pos.liquidationPrice),
          color: '#F6465D',
          lineWidth: 1,
          lineStyle: 3, // Dotted
          axisLabelVisible: true,
          title: `Liq Price`,
        });
      }
    });

    activeOrders.forEach((ord) => {
      candleSeriesRef.current?.createPriceLine({
        price: Number(ord.price),
        color: ord.side === 'Buy' ? '#0ECB81' : '#F6465D',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: `${ord.side} Limit`,
      });
    });
  }, [positions, openOrders, selectedSymbol]);

  return (
    <div className="flex flex-col h-full bg-bg-secondary select-none">
      {/* Timeframe & Indicator Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-bg-card border-b border-border text-xs">
        <div className="flex items-center space-x-1">
          <span className="text-text-muted mr-2 font-medium">Time:</span>
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              onClick={() => setKlineInterval(tf.value)}
              className={`px-2 py-0.5 rounded font-medium transition-colors ${
                klineInterval === tf.value
                  ? 'bg-bg-panel text-accent-gold border border-accent-gold/40'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowMa(!showMa)}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
              showMa
                ? 'bg-bg-panel text-accent-gold border border-border'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            MA / Vol
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      <div ref={containerRef} className="flex-1 w-full relative min-h-[350px]" />
    </div>
  );
};
