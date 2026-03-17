import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  Copy,
  ExternalLink,
  X,
  Repeat,
} from "lucide-react";
import { useWallet, truncateAddress } from "@/hooks/use-wallet";
import WalletConnect from "@/components/wallet/WalletConnect";
import AddFundsModal from "@/components/wallet/AddFundsModal";
import WithdrawModal from "@/components/wallet/WithdrawModal";

interface WalletDrawerProps {
  open: boolean;
  onClose: () => void;
}

const WalletDrawer = ({ open, onClose }: WalletDrawerProps) => {
  const {
    status,
    address,
    balance,
    balanceUsd,
    network,
    solscanUrl,
    refreshBalance,
    isRefreshing,
    copyAddress,
  } = useWallet();

  const [addFundsOpen, setAddFundsOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  return (
    <>
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
              onClick={onClose}
            />

            {/* Drawer */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-[70] bg-card border-t border-border rounded-t-2xl max-h-[85vh] overflow-y-auto safe-bottom"
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-5 pb-4">
                <div className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-bold text-foreground">My Wallet</h2>
                </div>
                <button
                  onClick={onClose}
                  className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>

              {status !== "connected" ? (
                <div className="px-5 pb-8 text-center">
                  <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground mb-4">
                    Connect your wallet to view balances
                  </p>
                  <WalletConnect variant="default" />
                </div>
              ) : (
                <div className="px-5 pb-8 space-y-5">
                  {/* Balance Card */}
                  <div className="p-5 rounded-xl bg-gradient-to-br from-primary/10 to-transparent border border-primary/20">
                    <p className="text-xs text-muted-foreground mb-1">Total Balance</p>
                    <div className="text-2xl font-bold text-foreground">
                      {balance !== null ? `${balance.toFixed(4)} SOL` : "—"}
                    </div>
                    {balanceUsd !== null && (
                      <p className="text-sm text-muted-foreground">
                        ≈ ${balanceUsd.toFixed(2)} USD
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs font-mono text-muted-foreground">
                        {address ? truncateAddress(address, 6, 4) : ""}
                      </span>
                      <button
                        onClick={copyAddress}
                        className="h-6 w-6 rounded flex items-center justify-center hover:bg-muted/50 transition-colors"
                      >
                        <Copy className="h-3 w-3 text-muted-foreground" />
                      </button>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="grid grid-cols-4 gap-3">
                    <QuickAction
                      icon={<ArrowUpRight className="h-5 w-5" />}
                      label="Send"
                      onClick={() => {
                        setWithdrawOpen(true);
                        onClose();
                      }}
                    />
                    <QuickAction
                      icon={<ArrowDownLeft className="h-5 w-5" />}
                      label="Receive"
                      onClick={() => {
                        setAddFundsOpen(true);
                        onClose();
                      }}
                    />
                    <QuickAction
                      icon={<Repeat className="h-5 w-5" />}
                      label="Swap"
                      onClick={() => {
                        // TODO: Open swap modal
                      }}
                    />
                    <QuickAction
                      icon={<RefreshCw className={`h-5 w-5 ${isRefreshing ? "animate-spin" : ""}`} />}
                      label="Refresh"
                      onClick={refreshBalance}
                    />
                  </div>

                  {/* View on Explorer */}
                  {solscanUrl && (
                    <button
                      onClick={() => window.open(solscanUrl, "_blank")}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" />
                      View on Solscan
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AddFundsModal open={addFundsOpen} onClose={() => setAddFundsOpen(false)} />
      <WithdrawModal open={withdrawOpen} onClose={() => setWithdrawOpen(false)} />
    </>
  );
};

function QuickAction({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors active:scale-95"
    >
      <span className="text-primary">{icon}</span>
      <span className="text-xs text-foreground font-medium">{label}</span>
    </button>
  );
}

export default WalletDrawer;
