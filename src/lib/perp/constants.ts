export interface PerpPair {
  symbol: string;       // display: "BTC/USDT"
  base: string;         // "BTC"
  quote: string;        // "USDT"
  pythSymbol: string;   // Pyth feed symbol e.g. "Crypto.BTC/USD"
  pythFeedId: string;   // Pyth hex feed id (with 0x prefix)
  icon: string;
  color: string;
  minQty: number;
  tickSize: number;
  maxLeverage: number;
  contractSize: number;
}

export const PERP_PAIRS: PerpPair[] = [
  {
    symbol: "BTC/USDT",
    base: "BTC",
    quote: "USDT",
    pythSymbol: "Crypto.BTC/USD",
    pythFeedId: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
    icon: "₿",
    color: "#F7931A",
    minQty: 0.001,
    tickSize: 0.1,
    maxLeverage: 125,
    contractSize: 0.001,
  },
  {
    symbol: "ETH/USDT",
    base: "ETH",
    quote: "USDT",
    pythSymbol: "Crypto.ETH/USD",
    pythFeedId: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
    icon: "Ξ",
    color: "#627EEA",
    minQty: 0.01,
    tickSize: 0.01,
    maxLeverage: 100,
    contractSize: 0.01,
  },
  {
    symbol: "SOL/USDT",
    base: "SOL",
    quote: "USDT",
    pythSymbol: "Crypto.SOL/USD",
    pythFeedId: "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
    icon: "◎",
    color: "#9945FF",
    minQty: 0.1,
    tickSize: 0.001,
    maxLeverage: 50,
    contractSize: 0.1,
  },
  {
    symbol: "JUP/USDT",
    base: "JUP",
    quote: "USDT",
    pythSymbol: "Crypto.JUP/USD",
    pythFeedId: "0x0a0408d619e9380abad35060f9192039ed5042fa6f82301d0e48bb52be830996",
    icon: "♃",
    color: "#29D6A1",
    minQty: 1,
    tickSize: 0.0001,
    maxLeverage: 20,
    contractSize: 1,
  },
  {
    symbol: "BNB/USDT",
    base: "BNB",
    quote: "USDT",
    pythSymbol: "Crypto.BNB/USD",
    pythFeedId: "0x2f95862b045670cd22bee3114c39763a4a08beeb663b145d283c31d7d1101c4f",
    icon: "◆",
    color: "#F0B90B",
    minQty: 0.01,
    tickSize: 0.01,
    maxLeverage: 75,
    contractSize: 0.01,
  },
];

export const TIMEFRAMES = [
  { label: "1m",  value: "1",   seconds: 60 },
  { label: "3m",  value: "3",   seconds: 180 },
  { label: "5m",  value: "5",   seconds: 300 },
  { label: "15m", value: "15",  seconds: 900 },
  { label: "30m", value: "30",  seconds: 1800 },
  { label: "1h",  value: "60",  seconds: 3600 },
  { label: "4h",  value: "240", seconds: 14400 },
  { label: "1d",  value: "1D",  seconds: 86400 },
] as const;

export type TimeframeValue = typeof TIMEFRAMES[number]["value"];

export const LEVERAGE_PRESETS = [1, 2, 5, 10, 20, 50, 75, 100, 125];

// ─── Pyth Network endpoints ───────────────────────────────────────────────────

/** Pyth Hermes WebSocket — real-time price feeds, no API key */
export const PYTH_HERMES_WS = "wss://hermes.pyth.network/ws";

/** Pyth Hermes HTTP — latest price snapshots, no API key */
export const PYTH_HERMES_HTTP = "https://hermes.pyth.network";

/**
 * Pyth Benchmarks TradingView shim — historical OHLCV bars, no API key.
 * GET /history?symbol=<pythSymbol>&resolution=<1|3|5|15|30|60|240|D>&from=<unix>&to=<unix>
 * Response: { s: "ok"|"no_data", t[], o[], h[], l[], c[], v[] }
 */
export const PYTH_BENCHMARKS = "https://benchmarks.pyth.network/v1/shims/tradingview";

/** LocalStorage key prefix for chart data cache */
export const CHART_STORAGE_PREFIX = "xbags_perp_chart_";

// ─── Shared data types ────────────────────────────────────────────────────────

export interface CandleData {
  time:   number;  // unix timestamp seconds
  open:   number;
  high:   number;
  low:    number;
  close:  number;
  volume: number;
}

export interface PerpTicker {
  price:            number;
  change24h:        number;
  changePercent24h: number;
  high24h:          number;
  low24h:           number;
  volume24h:        number;
  openInterest?:    number;
  fundingRate?:     number;
  nextFunding?:     number;
  markPrice?:       number;
  indexPrice?:      number;
}

export interface PerpPosition {
  id:               string;
  pair:             string;
  side:             "long" | "short";
  size:             number;
  entryPrice:       number;
  markPrice:        number;
  leverage:         number;
  margin:           number;
  pnl:              number;
  pnlPercent:       number;
  liquidationPrice: number;
  openedAt:         number;
}

export interface PerpOrder {
  id:        string;
  pair:      string;
  side:      "long" | "short";
  type:      "limit" | "market" | "stop";
  size:      number;
  price:     number;
  filled:    number;
  status:    "open" | "filled" | "cancelled";
  createdAt: number;
}