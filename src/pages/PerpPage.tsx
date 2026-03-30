import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PerpChart from "@/components/perp/PerpChart";
import PerpTradingPanel from "@/components/perp/PerpTradingPanel";
import PerpPairSelector from "@/components/perp/PerpPairSelector";
import PerpTickerBar from "@/components/perp/PerpTickerBar";
import PerpPositions from "@/components/perp/PerpPositions";
import { usePerpMarket } from "@/hooks/use-perp-market";
import { PERP_PAIRS, type PerpPair } from "@/lib/perp/constants";

const PerpPage = () => {
  const [activePair, setActivePair] = useState<PerpPair>(PERP_PAIRS[0]);
  const [activeTimeframe, setActiveTimeframe] = useState("15");
  const { ticker, loading } = usePerpMarket(activePair.pythSymbol);

  const handlePairChange = useCallback((pair: PerpPair) => {
    setActivePair(pair);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      {/* Ticker Bar */}
      <PerpTickerBar activePair={activePair} ticker={ticker} />

      {/* Pair Selector */}
      <PerpPairSelector
        pairs={PERP_PAIRS}
        activePair={activePair}
        onSelect={handlePairChange}
        ticker={ticker}
      />

      {/* Main Content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Chart Area */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-border">
          <PerpChart
            pair={activePair}
            timeframe={activeTimeframe}
            onTimeframeChange={setActiveTimeframe}
          />
        </div>

        {/* Trading Panel */}
        <div className="w-[320px] lg:w-[360px] shrink-0 flex flex-col overflow-hidden">
          <PerpTradingPanel pair={activePair} ticker={ticker} />
        </div>
      </div>

      {/* Positions / Orders */}
      <div className="h-[200px] shrink-0 border-t border-border">
        <PerpPositions pair={activePair} ticker={ticker} />
      </div>
    </div>
  );
};

export default PerpPage;