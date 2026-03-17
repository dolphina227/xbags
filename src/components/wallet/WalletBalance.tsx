import { RefreshCw, Eye, EyeOff } from "lucide-react";
import { useWallet } from "@/hooks/use-wallet";
import { motion } from "framer-motion";

interface WalletBalanceProps {
  variant?: "default" | "compact" | "large";
  showToggle?: boolean;
  showRefresh?: boolean;
}

const WalletBalance = ({
  variant = "default",
  showToggle = true,
  showRefresh = true,
}: WalletBalanceProps) => {
  const { balance, balanceUsd, showBalance, toggleBalance, refreshBalance, isRefreshing } =
    useWallet();

  if (balance === null) return null;

  if (variant === "large") {
    return (
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Total Balance</p>
          <p className="text-3xl font-extrabold text-foreground font-mono">
            {showBalance ? `${balance.toFixed(4)} SOL` : "••••••••"}
          </p>
          {showBalance && balanceUsd !== null && (
            <p className="text-sm text-muted-foreground font-mono mt-0.5">
              ≈ ${balanceUsd.toFixed(2)} USD
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {showToggle && (
            <button
              onClick={toggleBalance}
              className="h-9 w-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label={showBalance ? "Hide balance" : "Show balance"}
            >
              {showBalance ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          )}
          {showRefresh && (
            <button
              onClick={refreshBalance}
              disabled={isRefreshing}
              className="h-9 w-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              aria-label="Refresh balance"
            >
              <motion.div animate={isRefreshing ? { rotate: 360 } : {}} transition={{ duration: 1, repeat: isRefreshing ? Infinity : 0, ease: "linear" }}>
                <RefreshCw className="h-4 w-4" />
              </motion.div>
            </button>
          )}
        </div>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <span className="text-sm font-semibold text-foreground font-mono">
        {showBalance ? `${balance.toFixed(2)} SOL` : "••••"}
      </span>
    );
  }

  // Default
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
      <div>
        <div className="text-xs text-muted-foreground mb-0.5">Balance</div>
        <div className="text-sm font-bold text-foreground font-mono">
          {showBalance ? `${balance.toFixed(4)} SOL` : "••••••"}
        </div>
        {showBalance && balanceUsd !== null && (
          <div className="text-xs text-muted-foreground font-mono">
            ≈ ${balanceUsd.toFixed(2)}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1">
        {showToggle && (
          <button
            onClick={toggleBalance}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            {showBalance ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
        {showRefresh && (
          <button
            onClick={refreshBalance}
            disabled={isRefreshing}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            <motion.div animate={isRefreshing ? { rotate: 360 } : {}} transition={{ duration: 1, repeat: isRefreshing ? Infinity : 0, ease: "linear" }}>
              <RefreshCw className="h-3.5 w-3.5" />
            </motion.div>
          </button>
        )}
      </div>
    </div>
  );
};

export default WalletBalance;
