import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowUpRight, AlertCircle, Check, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWallet, truncateAddress, isValidSolanaAddress } from "@/hooks/use-wallet";
import { toast } from "sonner";
import { z } from "zod";

interface WithdrawModalProps {
  open: boolean;
  onClose: () => void;
}

const ESTIMATED_FEE = 0.000005; // ~5000 lamports

const WithdrawModal = ({ open, onClose }: WithdrawModalProps) => {
  const { address, balance, network, sendTransaction, isSending, solPrice } = useWallet();
  const [step, setStep] = useState<"form" | "confirm" | "success">("form");
  const [toAddress, setToAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [amountMode, setAmountMode] = useState<"sol" | "usd">("sol");
  const [errors, setErrors] = useState<{ to?: string; amount?: string }>({});
  const [txSignature, setTxSignature] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setStep("form");
      setToAddress("");
      setAmount("");
      setErrors({});
      setTxSignature(null);
    }
  }, [open]);

  const solAmount =
    amountMode === "sol"
      ? parseFloat(amount) || 0
      : solPrice
      ? (parseFloat(amount) || 0) / solPrice
      : 0;

  const usdAmount =
    amountMode === "usd"
      ? parseFloat(amount) || 0
      : solPrice
      ? (parseFloat(amount) || 0) * solPrice
      : 0;

  const validate = useCallback(() => {
    const errs: { to?: string; amount?: string } = {};

    if (!toAddress.trim()) {
      errs.to = "Address is required";
    } else if (!isValidSolanaAddress(toAddress.trim())) {
      errs.to = "Invalid Solana address";
    } else if (toAddress.trim() === address) {
      errs.to = "Cannot send to yourself";
    }

    if (!amount || parseFloat(amount) <= 0) {
      errs.amount = "Amount must be greater than 0";
    } else if (balance !== null && solAmount + ESTIMATED_FEE > balance) {
      errs.amount = "Insufficient balance (including fee)";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [toAddress, amount, solAmount, balance, address]);

  const handleReview = () => {
    if (validate()) setStep("confirm");
  };

  const handleSend = async () => {
    const sig = await sendTransaction(toAddress.trim(), solAmount);
    if (sig) {
      setTxSignature(sig);
      setStep("success");
    }
  };

  const handleMax = () => {
    if (balance !== null) {
      const max = Math.max(0, balance - ESTIMATED_FEE);
      if (amountMode === "sol") {
        setAmount(max.toFixed(6));
      } else if (solPrice) {
        setAmount((max * solPrice).toFixed(2));
      }
    }
  };

  const handleBackdrop = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget && !isSending) onClose();
    },
    [onClose, isSending]
  );

  if (!address) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          onClick={handleBackdrop}
        >
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative w-full max-w-md rounded-xl bg-card border border-border shadow-modal overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-2">
                <ArrowUpRight className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-bold text-foreground">
                  {step === "success" ? "Transaction Sent" : "Withdraw SOL"}
                </h2>
              </div>
              {!isSending && (
                <button
                  onClick={onClose}
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="p-5">
              {/* FORM */}
              {step === "form" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  {/* To address */}
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1.5 block">
                      Destination Address
                    </label>
                    <Input
                      value={toAddress}
                      onChange={(e) => {
                        setToAddress(e.target.value);
                        setErrors((prev) => ({ ...prev, to: undefined }));
                      }}
                      placeholder="Enter Solana address..."
                      className="font-mono text-xs bg-muted/50 border-border focus:border-primary"
                    />
                    {errors.to && (
                      <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.to}
                      </p>
                    )}
                  </div>

                  {/* Amount */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-sm font-medium text-foreground">Amount</label>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setAmountMode("sol")}
                          className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                            amountMode === "sol"
                              ? "bg-primary/20 text-primary"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          SOL
                        </button>
                        <button
                          onClick={() => setAmountMode("usd")}
                          className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                            amountMode === "usd"
                              ? "bg-primary/20 text-primary"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          USD
                        </button>
                      </div>
                    </div>
                    <div className="relative">
                      <Input
                        type="number"
                        value={amount}
                        onChange={(e) => {
                          setAmount(e.target.value);
                          setErrors((prev) => ({ ...prev, amount: undefined }));
                        }}
                        placeholder={amountMode === "sol" ? "0.00 SOL" : "$0.00"}
                        className="font-mono bg-muted/50 border-border focus:border-primary pr-16"
                        step="any"
                        min="0"
                      />
                      <button
                        onClick={handleMax}
                        className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-0.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                      >
                        MAX
                      </button>
                    </div>
                    {amount && parseFloat(amount) > 0 && (
                      <p className="text-xs text-muted-foreground mt-1 font-mono">
                        ≈{" "}
                        {amountMode === "sol"
                          ? `$${usdAmount.toFixed(2)} USD`
                          : `${solAmount.toFixed(6)} SOL`}
                      </p>
                    )}
                    {errors.amount && (
                      <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.amount}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      Available: {balance?.toFixed(4)} SOL · Fee: ~{ESTIMATED_FEE} SOL
                    </p>
                  </div>

                  <Button
                    onClick={handleReview}
                    className="w-full bg-primary text-primary-foreground hover:bg-secondary font-semibold"
                    disabled={!toAddress || !amount}
                  >
                    Review Transaction
                  </Button>
                </motion.div>
              )}

              {/* CONFIRM */}
              {step === "confirm" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  <div className="rounded-lg bg-muted/50 border border-border p-4 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">From</span>
                      <span className="font-mono text-foreground">{truncateAddress(address, 6, 4)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">To</span>
                      <span className="font-mono text-foreground">{truncateAddress(toAddress, 6, 4)}</span>
                    </div>
                    <div className="border-t border-border pt-3 flex justify-between text-sm">
                      <span className="text-muted-foreground">Amount</span>
                      <span className="font-bold text-foreground">{solAmount.toFixed(6)} SOL</span>
                    </div>
                    {solPrice && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Value</span>
                        <span className="text-muted-foreground">${usdAmount.toFixed(2)} USD</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Network Fee</span>
                      <span className="text-muted-foreground">~{ESTIMATED_FEE} SOL</span>
                    </div>
                    <div className="border-t border-border pt-3 flex justify-between text-sm">
                      <span className="text-muted-foreground">Network</span>
                      <span className="text-foreground">
                        {network === "mainnet-beta" ? "Mainnet" : "Devnet"}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setStep("form")}
                      disabled={isSending}
                      className="flex-1 border-border"
                    >
                      Back
                    </Button>
                    <Button
                      onClick={handleSend}
                      disabled={isSending}
                      className="flex-1 bg-primary text-primary-foreground hover:bg-secondary font-semibold"
                    >
                      {isSending ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Sending...
                        </span>
                      ) : (
                        "Confirm & Send"
                      )}
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* SUCCESS */}
              {step === "success" && txSignature && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center space-y-4"
                >
                  <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
                    <Check className="h-8 w-8 text-success" />
                  </div>
                  <div>
                    <p className="font-bold text-lg text-foreground">Transaction Sent!</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {solAmount.toFixed(6)} SOL → {truncateAddress(toAddress, 6, 4)}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 border border-border">
                    <p className="text-xs text-muted-foreground mb-1">Transaction Signature</p>
                    <code className="text-xs text-foreground font-mono break-all">{txSignature}</code>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() =>
                        window.open(
                          `https://solscan.io/tx/${txSignature}${
                            network === "devnet" ? "?cluster=devnet" : ""
                          }`,
                          "_blank"
                        )
                      }
                      className="flex-1 gap-2 border-border"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Solscan
                    </Button>
                    <Button
                      onClick={onClose}
                      className="flex-1 bg-primary text-primary-foreground hover:bg-secondary"
                    >
                      Done
                    </Button>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default WithdrawModal;
