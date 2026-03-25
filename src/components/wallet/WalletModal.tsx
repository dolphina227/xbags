import { useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ExternalLink, AlertCircle, RefreshCw, Download, Smartphone } from "lucide-react";
import { useWallet, isMobile } from "@/hooks/use-wallet";
import { Button } from "@/components/ui/button";

interface WalletModalProps {
  open: boolean;
  onClose: () => void;
}

const INSTALL_URLS: Record<string, string> = {
  Phantom: "https://phantom.app/",
  Solflare: "https://solflare.com/",
  Backpack: "https://backpack.app/",
};

const WalletModal = ({ open, onClose }: WalletModalProps) => {
  const { wallets, connect, status, errorMessage, retryConnect } = useWallet();
  const modalRef = useRef<HTMLDivElement>(null);
  const firstFocusRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  useEffect(() => {
    if (open && firstFocusRef.current) firstFocusRef.current.focus();
  }, [open]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  // ── FIX: HANDLE SELECT - BIAR WALLET ADAPTER YANG HANDLE DEEP LINK ──
  const handleSelect = async (walletName: string) => {
    // Langsung connect, Wallet Adapter akan handle deep link + connection request
    await connect(walletName);
  };

  useEffect(() => {
    if (status === "connected" && open) onClose();
  }, [status, open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          onClick={handleBackdropClick}
          role="dialog"
          aria-modal="true"
          aria-label="Connect Wallet"
        >
          <motion.div
            ref={modalRef}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-sm rounded-xl bg-card border border-border shadow-modal p-6"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-foreground">Connect Wallet</h2>
              <button
                ref={firstFocusRef}
                onClick={onClose}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Close modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-5">
              Connect a Solana wallet to get started with xbags
            </p>

            {/* Mobile Info */}
            {isMobile() && (
              <div className="mb-4 p-3 rounded-lg bg-primary/10 border border-primary/20 flex items-start gap-3">
                <Smartphone className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground font-medium">
                    Using Mobile Browser?
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Tap a wallet to open the app and connect
                  </p>
                </div>
              </div>
            )}

            {/* Error state */}
            {status === "error" && errorMessage && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-3"
              >
                <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-destructive font-medium">{errorMessage}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={retryConnect}
                    className="mt-2 gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 h-7 px-2"
                  >
                    <RefreshCw className="h-3 w-3" /> Retry
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Wallet list */}
            <div className="space-y-2" role="listbox" aria-label="Available wallets">
              {wallets.map((wallet) => {
                const isConnecting = status === "connecting";
                const isInstalled = wallet.installed;

                return (
                  <motion.button
                    key={wallet.name}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => handleSelect(wallet.name)}
                    disabled={isConnecting}
                    role="option"
                    aria-selected={false}
                    aria-label={`${isInstalled ? "Connect to " : "Install "} ${wallet.label}`}
                    className="w-full flex items-center gap-4 p-4 rounded-lg border border-border hover:border-primary/30 hover:bg-muted/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                  >
                    <img
                      src={wallet.icon}
                      alt={wallet.label}
                      className="h-8 w-8 rounded-lg"
                      onError={(e) => {
                        const el = e.target as HTMLImageElement;
                        el.style.display = "none";
                      }}
                    />
                    <div className="flex-1 text-left">
                      <div className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                        {wallet.label}
                      </div>
                      {!isInstalled && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Download className="h-3 w-3" />
                          Not installed — click to install
                        </div>
                      )}
                    </div>
                    {isInstalled ? (
                      <div className="h-2 w-2 rounded-full bg-success" />
                    ) : (
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    )}
                  </motion.button>
                );
              })}
            </div>

            {/* Connecting overlay */}
            <AnimatePresence>
              {status === "connecting" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 rounded-xl bg-card/90 backdrop-blur-sm flex flex-col items-center justify-center gap-4"
                >
                  <div className="h-10 w-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm font-medium text-foreground">Connecting...</p>
                  <p className="text-xs text-muted-foreground">
                    Approve the request in your wallet
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            <p className="text-xs text-muted-foreground text-center mt-6">
              By connecting, you agree to our Terms of Service
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default WalletModal;