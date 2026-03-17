import { useState } from "react";
import { motion } from "framer-motion";
import { Wallet, ArrowUpRight, ArrowDownLeft, RefreshCw, Plus, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWallet, truncateAddress } from "@/hooks/use-wallet";
import WalletConnect from "@/components/wallet/WalletConnect";
import WalletBalance from "@/components/wallet/WalletBalance";
import AddFundsModal from "@/components/wallet/AddFundsModal";
import WithdrawModal from "@/components/wallet/WithdrawModal";

const transactions = [
  { id: 1, type: "received", amount: "+2.5 SOL", from: "7xKX...gAsU", time: "2h ago" },
  { id: 2, type: "sent", amount: "-0.8 SOL", to: "3mNP...kL2q", time: "5h ago" },
  { id: 3, type: "received", amount: "+1.2 SOL", from: "9pQR...vW4x", time: "1d ago" },
  { id: 4, type: "received", amount: "+5.0 SOL", from: "2aBC...dE6f", time: "3d ago" },
];

const WalletPage = () => {
  const { status, address, balance, network, solscanUrl, refreshBalance } = useWallet();
  const [addFundsOpen, setAddFundsOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  if (status !== "connected") {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-20 text-center">
        <Wallet className="h-16 w-16 text-muted-foreground mx-auto mb-6" />
        <h1 className="text-2xl font-bold mb-2">Connect Your Wallet</h1>
        <p className="text-muted-foreground mb-8">Connect your Solana wallet to view balances and transactions.</p>
        <WalletConnect variant="default" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-6">
      <div className="flex items-center gap-2 mb-6">
        <Wallet className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Wallet</h1>
      </div>

      {/* Balance Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 rounded-xl bg-gradient-to-br from-primary/10 to-transparent border border-primary/20 mb-6"
      >
        <WalletBalance variant="large" />
        <p className="text-sm text-muted-foreground font-mono mt-2">
          {address ? truncateAddress(address, 6, 4) : ""} · {network === "mainnet-beta" ? "Mainnet" : "Devnet"}
        </p>
        <div className="flex gap-3 mt-6">
          <Button
            size="sm"
            className="gap-2 bg-primary text-primary-foreground hover:bg-secondary"
            onClick={() => setWithdrawOpen(true)}
          >
            <ArrowUpRight className="h-4 w-4" /> Send
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-2 border-border hover:border-primary"
            onClick={() => setAddFundsOpen(true)}
          >
            <Plus className="h-4 w-4" /> Add Funds
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-2 border-border hover:border-primary"
            onClick={refreshBalance}
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          {solscanUrl && (
            <Button
              size="sm"
              variant="outline"
              className="gap-2 border-border hover:border-primary"
              onClick={() => window.open(solscanUrl, "_blank")}
            >
              <ExternalLink className="h-4 w-4" /> Solscan
            </Button>
          )}
        </div>
      </motion.div>

      {/* Transactions */}
      <h2 className="font-semibold mb-4">Recent Transactions</h2>
      <div className="space-y-2">
        {transactions.map((tx, i) => (
          <motion.div
            key={tx.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border"
          >
            <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${tx.type === "received" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
              {tx.type === "received" ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground">{tx.type === "received" ? "Received" : "Sent"}</div>
              <div className="text-xs text-muted-foreground font-mono">{tx.type === "received" ? `From ${tx.from}` : `To ${tx.to}`}</div>
            </div>
            <div className="text-right">
              <div className={`text-sm font-semibold ${tx.type === "received" ? "text-success" : "text-destructive"}`}>{tx.amount}</div>
              <div className="text-xs text-muted-foreground">{tx.time}</div>
            </div>
          </motion.div>
        ))}
      </div>

      <AddFundsModal open={addFundsOpen} onClose={() => setAddFundsOpen(false)} />
      <WithdrawModal open={withdrawOpen} onClose={() => setWithdrawOpen(false)} />
    </div>
  );
};

export default WalletPage;
