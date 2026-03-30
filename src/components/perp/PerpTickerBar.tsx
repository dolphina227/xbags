import type { PerpPair, PerpTicker } from "@/lib/perp/constants";

interface PerpTickerBarProps {
  activePair: PerpPair;
  ticker: PerpTicker | null;
}

const PerpTickerBar = ({ activePair, ticker }: PerpTickerBarProps) => {
  const isPositive = (ticker?.changePercent24h ?? 0) >= 0;
  const price = ticker?.price ?? 0;

  const stats = [
    {
      label: "24h Change",
      value: ticker
        ? `${isPositive ? "+" : ""}${ticker.changePercent24h?.toFixed(2)}%`
        : "—",
      color: isPositive ? "text-green-400" : "text-red-400",
    },
    {
      label: "24h High",
      value: ticker?.high24h
        ? ticker.high24h >= 1000
          ? ticker.high24h.toLocaleString("en-US", { maximumFractionDigits: 1 })
          : ticker.high24h.toFixed(3)
        : "—",
      color: "text-green-400",
    },
    {
      label: "24h Low",
      value: ticker?.low24h
        ? ticker.low24h >= 1000
          ? ticker.low24h.toLocaleString("en-US", { maximumFractionDigits: 1 })
          : ticker.low24h.toFixed(3)
        : "—",
      color: "text-red-400",
    },
    {
      label: "24h Volume",
      value: ticker?.volume24h
        ? ticker.volume24h >= 1e9
          ? `${(ticker.volume24h / 1e9).toFixed(2)}B`
          : ticker.volume24h >= 1e6
          ? `${(ticker.volume24h / 1e6).toFixed(2)}M`
          : `${(ticker.volume24h / 1e3).toFixed(2)}K`
        : "—",
      color: "text-foreground",
    },
    {
      label: "Funding",
      value:
        ticker?.fundingRate !== undefined
          ? `${(ticker.fundingRate * 100).toFixed(4)}%`
          : "—",
      color:
        (ticker?.fundingRate ?? 0) >= 0 ? "text-green-400" : "text-red-400",
    },
    {
      label: "Open Interest",
      value: ticker?.openInterest
        ? ticker.openInterest >= 1e9
          ? `$${(ticker.openInterest / 1e9).toFixed(2)}B`
          : `$${(ticker.openInterest / 1e6).toFixed(2)}M`
        : "—",
      color: "text-foreground",
    },
  ];

  return (
    <div className="flex items-center gap-6 px-4 py-2.5 border-b border-border bg-card/50 overflow-x-auto no-scrollbar">
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-2xl font-bold" style={{ color: activePair.color }}>
          {activePair.icon}
        </span>

        <div>
          <div className="text-sm font-bold">{activePair.symbol}</div>
          <div className="text-[10px] text-muted-foreground">Perpetual</div>
        </div>

        <div className="w-px h-8 bg-border" />

        <div>
          <div
            className={`text-lg font-bold font-mono ${
              isPositive ? "text-green-400" : "text-red-400"
            }`}
          >
            {price > 0
              ? price >= 1000
                ? price.toLocaleString()
                : price.toFixed(3)
              : "—"}
          </div>

          <div className="text-[10px] text-muted-foreground">
            ≈ ${price.toFixed(2)}
          </div>
        </div>
      </div>

      {stats.map((s) => (
        <div key={s.label}>
          <div className="text-[10px] text-muted-foreground">{s.label}</div>
          <div className={`text-xs font-bold ${s.color}`}>{s.value}</div>
        </div>
      ))}
    </div>
  );
};

export default PerpTickerBar;