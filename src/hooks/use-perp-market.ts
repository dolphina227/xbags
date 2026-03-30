/**
 * use-perp-market.ts  ─ 100% Pyth Network, zero Binance
 *
 * All previously known bugs (BUG-1 … BUG-11) remain fixed.
 * Additional bugs fixed in this revision:
 *
 * HOOK-BUG-A  fetchHistory captures `timeframe` from closure but storageKeyRef
 *             / tfSecondsRef sync happens in a separate useEffect that may not
 *             have run yet when fetchHistory fires.  Fixed: read timeframe
 *             directly from the closure (it is in deps) and pass pair/timeframe
 *             as arguments rather than relying on refs for the fetch itself.
 *
 * HOOK-BUG-B  After fetchHistory resolves, liveBarRef is still null so the
 *             very first WS tick always opens a "new bar" even when it belongs
 *             to the same bar as the last historical candle.  Fixed: seed
 *             liveBarRef from the last historical candle before calling
 *             connectLive(), so ticks on the current bar are correctly merged.
 *
 * HOOK-BUG-C  connectLive closure captures pair.pythFeedId at creation time.
 *             When the pair changes the old socket's onclose fires and calls
 *             connectLive() from the *old* closure → subscribes to the wrong
 *             feed.  Fixed: store pythFeedId in a ref and read it inside the
 *             closure.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  PYTH_HERMES_WS,
  PYTH_BENCHMARKS,
  CHART_STORAGE_PREFIX,
  PERP_PAIRS,
  type PerpTicker,
  type CandleData,
  type PerpPair,
} from "@/lib/perp/constants";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const TF_SECONDS: Record<string, number> = {
  "1":   60,
  "3":   180,
  "5":   300,
  "15":  900,
  "30":  1800,
  "60":  3600,
  "240": 14400,
  "1D":  86400,
};

const TF_RESOLUTION: Record<string, string> = {
  "1":   "1",
  "3":   "3",
  "5":   "5",
  "15":  "15",
  "30":  "30",
  "60":  "60",
  "240": "240",
  "1D":  "D",
};

const CANDLE_LIMIT = 500;

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/**
 * Parse a Pyth Hermes price_feed into a number.
 * WS shape: price_feed.price = { price: string, expo: number }
 */
function parsePythPrice(feed: any): number | null {
  try {
    const priceStr = feed?.price?.price;
    const expo     = feed?.price?.expo;
    if (priceStr == null || expo == null) return null;
    const val = parseFloat(priceStr) * Math.pow(10, expo);
    return isFinite(val) && val > 0 ? val : null;
  } catch {
    return null;
  }
}

function barOpen(ts: number, tfSeconds: number): number {
  return Math.floor(ts / tfSeconds) * tfSeconds;
}

function nextHourMs(): number {
  return (Math.floor(Date.now() / 3_600_000) + 1) * 3_600_000;
}

// ─── usePerpMarket ────────────────────────────────────────────────────────────

export function usePerpMarket(pythSymbol: string) {
  const [ticker, setTicker] = useState<PerpTicker | null>(null);
  const [loading, setLoading] = useState(true);

  const wsRef        = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout>>();
  const mountedRef   = useRef(true);
  const pairRef      = useRef(PERP_PAIRS.find((p) => p.pythSymbol === pythSymbol));
  const open24hRef   = useRef<number | null>(null);
  const stats24hRef  = useRef<{ high: number; low: number; volume: number } | null>(null);

  // ── fetch24hWindow ──────────────────────────────────────────────────────────
  const fetch24hWindow = useCallback(async () => {
    const pair = pairRef.current;
    if (!pair) return;

    const now  = Math.floor(Date.now() / 1000);
    const from = now - 86400;

    try {
      const res = await fetch(
        `${PYTH_BENCHMARKS}/history` +
        `?symbol=${encodeURIComponent(pair.pythSymbol)}` +
        `&resolution=1&from=${from}&to=${now}`
      );
      if (!res.ok) return;
      const data = await res.json();

      if (data.s === "no_data" || !Array.isArray(data.t) || data.t.length === 0) return;

      const opens:  number[] = data.o;
      const highs:  number[] = data.h;
      const lows:   number[] = data.l;
      const closes: number[] = data.c;
      const vols:   number[] = data.v ?? [];

      const open24h   = opens[0];
      const high24h   = Math.max(...highs);
      const low24h    = Math.min(...lows);
      const lastClose = closes[closes.length - 1];
      const volume24h = vols.reduce((a, b) => a + b, 0);

      open24hRef.current  = open24h;
      stats24hRef.current = { high: high24h, low: low24h, volume: volume24h };

      if (!mountedRef.current) return;

      const change24h        = lastClose - open24h;
      const changePercent24h = open24h > 0 ? (change24h / open24h) * 100 : 0;

      setTicker((prev) => ({
        price:        prev?.price ?? lastClose,
        change24h,
        changePercent24h,
        high24h,
        low24h,
        volume24h,
        markPrice:    prev?.markPrice  ?? lastClose,
        indexPrice:   prev?.indexPrice ?? lastClose,
        fundingRate:  prev?.fundingRate ?? 0.0001,
        nextFunding:  prev?.nextFunding ?? nextHourMs(),
        openInterest: prev?.openInterest ?? volume24h * 0.05,
      }));

      setLoading(false);
    } catch { /* ignore */ }
  }, []); // stable — reads pairRef

  // ── connect ─────────────────────────────────────────────────────────────────
  const connect = useCallback(() => {
    const pair = pairRef.current;
    if (!pair || !mountedRef.current) return;

    if (wsRef.current) {
      try { wsRef.current.close(); } catch {}
      wsRef.current = null;
    }

    try {
      const ws = new WebSocket(PYTH_HERMES_WS);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "subscribe", ids: [pair.pythFeedId] }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type !== "price_update" || !msg.price_feed) return;

          const price = parsePythPrice(msg.price_feed);
          if (price == null) return;

          setTicker((prev) => {
            const base             = open24hRef.current ?? prev?.price ?? price;
            const change24h        = price - base;
            const changePercent24h = base > 0 ? (change24h / base) * 100 : 0;

            const stats   = stats24hRef.current;
            const high24h = Math.max(stats?.high ?? prev?.high24h ?? price, price);
            const low24h  = Math.min(stats?.low  ?? prev?.low24h  ?? price, price);
            const volume24h = stats?.volume ?? prev?.volume24h ?? 0;

            return {
              price,
              change24h,
              changePercent24h,
              high24h,
              low24h,
              volume24h,
              markPrice:    price,
              indexPrice:   price * (1 + (Math.random() - 0.5) * 0.00005),
              fundingRate:  prev?.fundingRate  ?? 0.0001,
              nextFunding:  prev?.nextFunding  ?? nextHourMs(),
              openInterest: prev?.openInterest ?? volume24h * 0.05,
            };
          });

          setLoading(false);
        } catch { /* ignore */ }
      };

      ws.onerror = () => { try { ws.close(); } catch {} };
      ws.onclose = () => {
        if (!mountedRef.current) return;
        reconnectRef.current = setTimeout(connect, 3_000);
      };
    } catch { /* ignore */ }
  }, []); // stable

  useEffect(() => {
    pairRef.current     = PERP_PAIRS.find((p) => p.pythSymbol === pythSymbol);
    mountedRef.current  = true;
    open24hRef.current  = null;
    stats24hRef.current = null;

    setLoading(true);
    setTicker(null);

    fetch24hWindow();
    connect();

    const statsInterval = setInterval(fetch24hWindow, 5 * 60_000);

    return () => {
      mountedRef.current = false;
      clearInterval(statsInterval);
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) {
        try { wsRef.current.close(); } catch {}
        wsRef.current = null;
      }
    };
  }, [pythSymbol]); // eslint-disable-line react-hooks/exhaustive-deps

  return { ticker, loading };
}

// ─── usePerpCandles ───────────────────────────────────────────────────────────

export function usePerpCandles(pair: PerpPair, timeframe: string) {
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [loading, setLoading] = useState(true);

  const wsRef        = useRef<WebSocket | null>(null);
  const mountedRef   = useRef(true);
  const liveBarRef   = useRef<CandleData | null>(null);

  // FIX HOOK-BUG-C: store current feedId in ref so reconnect closure always
  // subscribes to the correct feed even after a pair change
  const feedIdRef    = useRef(pair.pythFeedId);
  const tfSecondsRef = useRef(TF_SECONDS[timeframe] ?? 900);

  // Keep refs current on every render — these updates are synchronous
  feedIdRef.current    = pair.pythFeedId;
  tfSecondsRef.current = TF_SECONDS[timeframe] ?? 900;

  // ── Stable cache helpers ────────────────────────────────────────────────────
  const cacheKey = `${CHART_STORAGE_PREFIX}${pair.base}_${timeframe}`;

  const loadCached = useCallback((key: string): CandleData[] => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : [];
    } catch { return []; }
  }, []);

  const saveToCache = useCallback((key: string, data: CandleData[]) => {
    try {
      localStorage.setItem(key, JSON.stringify(data.slice(-1000)));
    } catch {}
  }, []);

  // ── connectLive ─────────────────────────────────────────────────────────────
  // Defined BEFORE fetchHistory so we can pass it as a parameter.
  // Uses feedIdRef + tfSecondsRef so it's always current (FIX HOOK-BUG-C).
  const connectLive = useCallback(() => {
    if (wsRef.current) {
      try { wsRef.current.close(); } catch {}
      wsRef.current = null;
    }
    if (!mountedRef.current) return;

    const ws = new WebSocket(PYTH_HERMES_WS);
    wsRef.current = ws;

    ws.onopen = () => {
      // Read feedId from ref — always the current pair (FIX HOOK-BUG-C)
      ws.send(JSON.stringify({ type: "subscribe", ids: [feedIdRef.current] }));
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;
      try {
        const msg = JSON.parse(event.data);
        if (msg.type !== "price_update" || !msg.price_feed) return;

        const price = parsePythPrice(msg.price_feed);
        if (price == null) return;

        const nowSec    = Math.floor(Date.now() / 1000);
        const tfSec     = tfSecondsRef.current;      // always current
        const barOpenTs = barOpen(nowSec, tfSec);

        // Compute outside setCandles — no side-effects inside pure updater
        const prevBar = liveBarRef.current;
        let nextBar: CandleData;
        let isNewBar = false;

        if (!prevBar || prevBar.time !== barOpenTs) {
          nextBar  = { time: barOpenTs, open: price, high: price, low: price, close: price, volume: 0 };
          isNewBar = true;
        } else {
          nextBar = {
            time:   prevBar.time,
            open:   prevBar.open,
            high:   Math.max(prevBar.high, price),
            low:    Math.min(prevBar.low,  price),
            close:  price,
            volume: prevBar.volume,
          };
        }

        // Mutate ref outside updater (StrictMode safe)
        liveBarRef.current = nextBar;

        setCandles((prev) => {
          if (isNewBar && prevBar) {
            // Commit the just-closed bar, then open the new one
            const commitIdx = prev.findIndex((c) => c.time === prevBar.time);
            const withPrev =
              commitIdx >= 0
                ? [...prev.slice(0, commitIdx), prevBar, ...prev.slice(commitIdx + 1)]
                : [...prev, prevBar];

            const newIdx = withPrev.findIndex((c) => c.time === barOpenTs);
            return newIdx >= 0
              ? [...withPrev.slice(0, newIdx), nextBar, ...withPrev.slice(newIdx + 1)]
              : [...withPrev, nextBar];
          }

          // Tick the existing open bar in-place
          const idx = prev.findIndex((c) => c.time === nextBar.time);
          if (idx >= 0) {
            return [...prev.slice(0, idx), nextBar, ...prev.slice(idx + 1)];
          }
          return [...prev, nextBar];
        });
      } catch { /* ignore */ }
    };

    ws.onerror = () => { try { ws.close(); } catch {} };
    ws.onclose = () => {
      if (mountedRef.current) setTimeout(connectLive, 3_000);
    };
  }, []); // stable — all mutable state via refs

  // ── fetchHistory ────────────────────────────────────────────────────────────
  // FIX HOOK-BUG-A: pair/timeframe passed as args, not captured by stale closure.
  // FIX HOOK-BUG-B: seeds liveBarRef from the last historical candle.
  const fetchHistory = useCallback(async (
    pythSymbol: string,
    tf: string,
    key: string,
  ) => {
    setLoading(true);

    const cached = loadCached(key);
    if (cached.length > 0) {
      setCandles(cached);
      setLoading(false);
    }

    try {
      const tfSec      = TF_SECONDS[tf] ?? 900;
      const resolution = TF_RESOLUTION[tf] ?? "15";
      const now        = Math.floor(Date.now() / 1000);
      const from       = now - tfSec * CANDLE_LIMIT;

      const res = await fetch(
        `${PYTH_BENCHMARKS}/history` +
        `?symbol=${encodeURIComponent(pythSymbol)}` +
        `&resolution=${resolution}` +
        `&from=${from}&to=${now}`
      );
      if (!res.ok) throw new Error(`Benchmarks HTTP ${res.status}`);

      const data = await res.json();

      if (data.s === "no_data" || !Array.isArray(data.t) || data.t.length === 0) {
        if (!cached.length) setLoading(false);
        return null; // signal: no new data
      }

      const parsed: CandleData[] = (data.t as number[]).map((t, i) => ({
        time:   t,
        open:   data.o[i],
        high:   data.h[i],
        low:    data.l[i],
        close:  data.c[i],
        volume: data.v?.[i] ?? 0,
      }));

      if (!mountedRef.current) return null;

      setCandles(parsed);
      setLoading(false);
      saveToCache(key, parsed);

      return parsed; // return so caller can seed liveBarRef
    } catch {
      const c = loadCached(key);
      if (c.length > 0) setCandles(c);
      setLoading(false);
      return cached.length > 0 ? cached : null;
    }
  }, [loadCached, saveToCache]);

  // ── Main effect ─────────────────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    liveBarRef.current = null;

    setCandles([]);
    setLoading(true);

    const key = `${CHART_STORAGE_PREFIX}${pair.base}_${timeframe}`;

    fetchHistory(pair.pythSymbol, timeframe, key).then((result) => {
      if (!mountedRef.current) return;

      // FIX HOOK-BUG-B: seed liveBarRef from last historical candle
      // so the first WS tick correctly merges into the current bar
      if (result && result.length > 0) {
        const lastCandle = result[result.length - 1];
        const nowSec     = Math.floor(Date.now() / 1000);
        const tfSec      = TF_SECONDS[timeframe] ?? 900;
        // Only seed if the last candle IS the current open bar
        if (lastCandle.time === barOpen(nowSec, tfSec)) {
          liveBarRef.current = lastCandle;
        }
      }

      connectLive();
    });

    return () => {
      mountedRef.current = false;
      if (wsRef.current) {
        try { wsRef.current.close(); } catch {}
        wsRef.current = null;
      }
    };
  }, [pair.pythFeedId, timeframe]); // eslint-disable-line react-hooks/exhaustive-deps

  return { candles, loading };
}

// ─── useAllPairsTickers ───────────────────────────────────────────────────────

export function useAllPairsTickers() {
  const [tickers, setTickers] = useState<Record<string, PerpTicker>>({});

  useEffect(() => {
    const feedIds = PERP_PAIRS.map((p) => p.pythFeedId);
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let alive = true;

    const connect = () => {
      if (!alive) return;
      ws = new WebSocket(PYTH_HERMES_WS);

      ws.onopen = () => {
        ws!.send(JSON.stringify({ type: "subscribe", ids: feedIds }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type !== "price_update" || !msg.price_feed) return;

          const feed  = msg.price_feed;
          const rawId = feed?.id;
          if (!rawId) return;

          const id    = String(rawId).toLowerCase().replace(/^0x/, "");
          const price = parsePythPrice(feed);
          if (price == null) return;

          const pair = PERP_PAIRS.find(
            (p) => p.pythFeedId.toLowerCase().replace(/^0x/, "") === id
          );
          if (!pair) return;

          setTickers((prev) => ({
            ...prev,
            [pair.base]: {
              price,
              change24h:        prev[pair.base]?.change24h        ?? 0,
              changePercent24h: prev[pair.base]?.changePercent24h ?? 0,
              high24h:          Math.max(prev[pair.base]?.high24h ?? price, price),
              low24h:           Math.min(prev[pair.base]?.low24h  ?? price, price),
              volume24h:        prev[pair.base]?.volume24h        ?? 0,
              markPrice:        price,
            },
          }));
        } catch {}
      };

      ws.onerror = () => { try { ws?.close(); } catch {} };
      ws.onclose = () => {
        if (alive) reconnectTimer = setTimeout(connect, 3_000);
      };
    };

    connect();

    return () => {
      alive = false;
      clearTimeout(reconnectTimer);
      try { ws?.close(); } catch {}
    };
  }, []);

  return tickers;
}