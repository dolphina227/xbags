import { useState } from "react";
import { useWallet } from "@/hooks/use-wallet";
import type { PerpPair, PerpTicker } from "@/lib/perp/constants";

type Tab = "positions" | "orders" | "history";

interface Props {
  pair: PerpPair;
  ticker: PerpTicker | null;
}

const PerpPositions = ({ pair, ticker }: Props) => {
  const { status } = useWallet();
  const [tab, setTab] = useState<Tab>("positions");

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-border">
        {["positions", "orders", "history"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t as Tab)}
            className={`px-3 py-2 text-xs ${
              tab === t ? "text-white border-b-2 border-primary" : "text-muted-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 flex items-center justify-center">
        {status !== "connected" ? (
          <p className="text-xs text-muted-foreground">
            Connect your wallet
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            COMING SOON
          </p>
        )}
      </div>
    </div>
  );
};

export default PerpPositions;