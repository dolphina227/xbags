import { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { TIMEFRAMES, type PerpPair } from "@/lib/perp/constants";
import { usePerpCandles } from "@/hooks/use-perp-market";

interface PerpChartProps {
  pair: PerpPair;
  timeframe: string;
  onTimeframeChange: (tf: string) => void;
}

// Format price helper
function fmtPrice(price: number, decimals = 2) {
  if (price >= 10000) return price.toFixed(1);
  if (price >= 100) return price.toFixed(2);
  if (price >= 1) return price.toFixed(3);
  return price.toFixed(4);
}

const PerpChart = ({ pair, timeframe, onTimeframeChange }: PerpChartProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);
  const { candles, loading } = usePerpCandles(pair, timeframe);
  const [chartReady, setChartReady] = useState(false);
  const [hoveredCandle, setHoveredCandle] = useState<any>(null);
  const lwcLoadedRef = useRef(false);

  // Dynamically load lightweight-charts
  const loadLWC = useCallback(async () => {
    if ((window as any).LightweightCharts) return (window as any).LightweightCharts;

    return new Promise<any>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/lightweight-charts@4.1.3/dist/lightweight-charts.standalone.production.js";
      script.onload = () => resolve((window as any).LightweightCharts);
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }, []);

  // Init chart
  const initChart = useCallback(async () => {
    if (!chartContainerRef.current) return;
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      seriesRef.current = null;
      volumeSeriesRef.current = null;
    }

    const LWC = await loadLWC();
    if (!chartContainerRef.current) return;

    const chart = LWC.createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      layout: {
        background: { type: "solid", color: "transparent" },
        textColor: "rgba(156, 163, 175, 0.9)",
        fontSize: 11,
        fontFamily: "'JetBrains Mono', 'Space Grotesk', monospace",
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)", style: 1 },
        horzLines: { color: "rgba(255,255,255,0.04)", style: 1 },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: "rgba(0, 255, 136, 0.4)",
          width: 1,
          style: 3,
          labelBackgroundColor: "#63D731",
        },
        horzLine: {
          color: "rgba(0, 255, 136, 0.4)",
          width: 1,
          style: 3,
          labelBackgroundColor: "#63D731",
        },
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.06)",
        scaleMargins: { top: 0.1, bottom: 0.25 },
        textColor: "rgba(156, 163, 175, 0.8)",
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.06)",
        timeVisible: true,
        secondsVisible: false,
        barSpacing: 8,
        fixLeftEdge: false,
        fixRightEdge: false,
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
    });

    chartRef.current = chart;

    // Candlestick series
    const candleSeries = chart.addCandlestickSeries({
      upColor: "#63D731",
      downColor: "#ef4444",
      borderUpColor: "#63D731",
      borderDownColor: "#ef4444",
      wickUpColor: "#429A1D",
      wickDownColor: "#cc2222",
    });
    seriesRef.current = candleSeries;

    // Volume series
    const volSeries = chart.addHistogramSeries({
      color: "#26a69a",
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
      scaleMargins: { top: 0.8, bottom: 0 },
    });
    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });
    volumeSeriesRef.current = volSeries;

    // Crosshair move for hover info
    chart.subscribeCrosshairMove((param: any) => {
      if (!param || !param.time || !param.seriesData) {
        setHoveredCandle(null);
        return;
      }
      const candle = param.seriesData.get(candleSeries);
      if (candle) setHoveredCandle(candle);
    });

    // Resize observer
    const ro = new ResizeObserver(() => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    });
    if (chartContainerRef.current) ro.observe(chartContainerRef.current);

    setChartReady(true);
    lwcLoadedRef.current = true;

    return () => ro.disconnect();
  }, [pair.base]);

  // Init chart when pair changes
  useEffect(() => {
    initChart();
    return () => {
      if (chartRef.current) {
        try { chartRef.current.remove(); } catch {}
        chartRef.current = null;
        seriesRef.current = null;
        volumeSeriesRef.current = null;
      }
    };
  }, [pair.base]);

  // Set candle data when ready
  useEffect(() => {
    if (!seriesRef.current || !volumeSeriesRef.current || candles.length === 0) return;

    try {
      const sorted = [...candles].sort((a, b) => a.time - b.time);

      seriesRef.current.setData(
        sorted.map((c) => ({
          time: c.time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }))
      );

      volumeSeriesRef.current.setData(
        sorted.map((c) => ({
          time: c.time,
          value: c.volume,
          color: c.close >= c.open ? "rgba(99,215,49,0.25)" : "rgba(239,68,68,0.25)",
        }))
      );

      // Scroll to right
      if (chartRef.current) {
        chartRef.current.timeScale().scrollToRealTime();
      }
    } catch {}
  }, [candles, chartReady]);

  const lastCandle = candles[candles.length - 1];
  const displayCandle = hoveredCandle || lastCandle;
  const isPositive = displayCandle
    ? displayCandle.close >= displayCandle.open
    : true;

  return (
    <div className="flex flex-col h-full">
      {/* Timeframe selector */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border bg-background/50">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf.value}
            onClick={() => onTimeframeChange(tf.value)}
            className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
              timeframe === tf.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {tf.label}
          </button>
        ))}

        {/* OHLCV hover info */}
        {displayCandle && (
          <div className="ml-4 flex items-center gap-3 text-xs font-mono">
            <span className="text-muted-foreground">O</span>
            <span className={isPositive ? "text-green-400" : "text-red-400"}>
              {fmtPrice(displayCandle.open)}
            </span>
            <span className="text-muted-foreground">H</span>
            <span className="text-green-400">{fmtPrice(displayCandle.high)}</span>
            <span className="text-muted-foreground">L</span>
            <span className="text-red-400">{fmtPrice(displayCandle.low)}</span>
            <span className="text-muted-foreground">C</span>
            <span className={isPositive ? "text-green-400" : "text-red-400"}>
              {fmtPrice(displayCandle.close)}
            </span>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          <span className="text-[10px] text-muted-foreground font-mono">
            {pair.symbol} · PERP
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 relative">
        {loading && candles.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <span className="text-xs text-muted-foreground">Loading chart...</span>
            </div>
          </div>
        )}
        <div
          ref={chartContainerRef}
          className="w-full h-full"
          style={{ opacity: candles.length === 0 && loading ? 0 : 1, transition: "opacity 0.3s" }}
        />
      </div>
    </div>
  );
};

export default PerpChart;