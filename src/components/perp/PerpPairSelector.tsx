import { motion } from "framer-motion";
import type { PerpPair, PerpTicker } from "@/lib/perp/constants";

interface PerpPairSelectorProps {
  pairs: PerpPair[];
  activePair: PerpPair;
  onSelect: (pair: PerpPair) => void;
  ticker: PerpTicker | null;
}

const PerpPairSelector = ({
  pairs,
  activePair,
  onSelect,
  ticker,
}: PerpPairSelectorProps) => {
  return (
    <div className="flex items-center gap-1 px-3 py-2 border-b border-border overflow-x-auto no-scrollbar bg-background/80">
      {pairs.map((pair) => {
        const isActive = pair.symbol === activePair.symbol;
        const changePercent = ticker && isActive ? ticker.changePercent24h : null;
        const isPositive = (changePercent ?? 0) >= 0;

        return (
          <button
            key={pair.symbol}
            onClick={() => onSelect(pair)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl whitespace-nowrap text-xs font-semibold transition-all shrink-0 border ${
              isActive
                ? "border-primary/30 bg-primary/10 text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <span className="text-sm font-bold" style={{ color: pair.color }}>
              {pair.icon}
            </span>
            <span>{pair.symbol}</span>
            <span className="font-mono text-[10px] text-muted-foreground">PERP</span>

            {isActive && changePercent !== null && (
              <span
                className={`text-[10px] font-bold ${
                  isPositive ? "text-green-400" : "text-red-400"
                }`}
              >
                {isPositive ? "+" : ""}
                {changePercent.toFixed(2)}%
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default PerpPairSelector;