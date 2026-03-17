import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CreditCard, QrCode, Copy, Check, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWallet, truncateAddress } from "@/hooks/use-wallet";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";

interface AddFundsModalProps {
  open: boolean;
  onClose: () => void;
}

type Tab = "buy" | "receive";

const AddFundsModal = ({ open, onClose }: AddFundsModalProps) => {
  const { address, network } = useWallet();
  const [activeTab, setActiveTab] = useState<Tab>("receive");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      setCopied(false);
      setActiveTab("receive");
    }
  }, [open]);

  const handleCopy = useCallback(() => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    toast.success("Address copied!");
    setTimeout(() => setCopied(false), 2000);
  }, [address]);

  const handleBackdrop = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
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
              <h2 className="text-lg font-bold text-foreground">Add Funds</h2>
              <button
                onClick={onClose}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border">
              <button
                onClick={() => setActiveTab("receive")}
                className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
                  activeTab === "receive" ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="flex items-center justify-center gap-2">
                  <QrCode className="h-4 w-4" />
                  Receive SOL
                </span>
                {activeTab === "receive" && (
                  <motion.div layoutId="addFundsTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                )}
              </button>
              <button
                onClick={() => setActiveTab("buy")}
                className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
                  activeTab === "buy" ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="flex items-center justify-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Buy SOL
                </span>
                {activeTab === "buy" && (
                  <motion.div layoutId="addFundsTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                )}
              </button>
            </div>

            {/* Content */}
            <div className="p-5">
              {activeTab === "receive" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
                  {/* QR Code */}
                  <div className="flex justify-center">
                    <div className="p-4 bg-white rounded-xl">
                      <QRCodeSVG
                        value={`solana:${address}`}
                        size={180}
                        bgColor="#ffffff"
                        fgColor="#000000"
                        level="M"
                      />
                    </div>
                  </div>

                  {/* Address */}
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground text-center">Your Solana Address</p>
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
                      <code className="flex-1 text-xs text-foreground font-mono break-all">
                        {address}
                      </code>
                      <button
                        onClick={handleCopy}
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-muted transition-colors shrink-0"
                      >
                        {copied ? (
                          <Check className="h-4 w-4 text-success" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground text-center">
                    Send SOL or SPL tokens to this address on{" "}
                    <span className="text-foreground font-medium">
                      {network === "mainnet-beta" ? "Mainnet" : "Devnet"}
                    </span>
                  </p>
                </motion.div>
              )}

              {activeTab === "buy" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  {/* MoonPay */}
                  <button
                    onClick={() => window.open(`https://www.moonpay.com/buy/sol`, "_blank")}
                    className="w-full flex items-center gap-4 p-4 rounded-lg border border-border hover:border-primary/30 hover:bg-muted/50 transition-all group"
                  >
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <CreditCard className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                        Buy with Card
                      </div>
                      <div className="text-xs text-muted-foreground">via MoonPay · Visa, Mastercard</div>
                    </div>
                  </button>

                  {/* Bridge */}
                  <button
                    onClick={() => window.open("https://portalbridge.com/", "_blank")}
                    className="w-full flex items-center gap-4 p-4 rounded-lg border border-border hover:border-primary/30 hover:bg-muted/50 transition-all group"
                  >
                    <div className="h-10 w-10 rounded-lg bg-info/10 flex items-center justify-center shrink-0">
                      <ArrowRightLeft className="h-5 w-5 text-info" />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                        Bridge from Ethereum
                      </div>
                      <div className="text-xs text-muted-foreground">via Portal Bridge · Wormhole</div>
                    </div>
                  </button>

                  <p className="text-xs text-muted-foreground text-center">
                    You'll be redirected to a third-party service
                  </p>
                </motion.div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AddFundsModal;
