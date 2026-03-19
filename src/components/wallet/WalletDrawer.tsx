import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet, ArrowUpRight, ArrowDownLeft, RefreshCw,
  Copy, ExternalLink, X, Repeat, LogOut,
} from "lucide-react";
import { useWallet, truncateAddress } from "@/hooks/use-wallet";
import { useNavigate } from "react-router-dom";
import WalletConnect from "@/components/wallet/WalletConnect";
import AddFundsModal from "@/components/wallet/AddFundsModal";
import WithdrawModal from "@/components/wallet/WithdrawModal";

interface WalletDrawerProps {
  open: boolean;
  onClose: () => void;
}

const WalletDrawer = ({ open, onClose }: WalletDrawerProps) => {
  const {
    status, address, balance, balanceUsd, solscanUrl,
    refreshBalance, isRefreshing, copyAddress, disconnect,
  } = useWallet();

  const [addFundsOpen, setAddFundsOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  // ── Resize state ──
  const [size, setSize] = useState({ w: 320, h: 480 });
  const resizing = useRef<{ dir: string; startX: number; startY: number; startW: number; startH: number } | null>(null);

  const startResize = (e: React.MouseEvent, dir: string) => {
    e.preventDefault();
    e.stopPropagation();
    resizing.current = { dir, startX: e.clientX, startY: e.clientY, startW: size.w, startH: size.h };
    const onMove = (ev: MouseEvent) => {
      if (!resizing.current) return;
      const { dir, startX, startY, startW, startH } = resizing.current;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      let w = startW, h = startH;
      if (dir.includes("e")) w = Math.max(260, startW + dx);
      if (dir.includes("w")) w = Math.max(260, startW - dx);
      if (dir.includes("s")) h = Math.max(200, startH + dy);
      if (dir.includes("n")) h = Math.max(200, startH - dy);
      setSize({ w, h });
    };
    const onUp = () => {
      resizing.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const content = (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop — hanya mobile */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm md:hidden"
            onClick={onClose}
          />

          {/* Mobile: drawer dari bawah */}
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-[70] bg-card border-t border-border rounded-t-2xl max-h-[85vh] overflow-y-auto md:hidden"
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>
            <WalletContent
              status={status} address={address} balance={balance}
              balanceUsd={balanceUsd} solscanUrl={solscanUrl}
              refreshBalance={refreshBalance} isRefreshing={isRefreshing}
              copyAddress={copyAddress} disconnect={disconnect}
              onClose={onClose}
              onAddFunds={() => { setAddFundsOpen(true); onClose(); }}
              onWithdraw={() => { setWithdrawOpen(true); onClose(); }}
            />
          </motion.div>

          {/* Desktop: draggable + resizable floating panel */}
          <motion.div
            drag dragMomentum={false} dragElastic={0}
            dragListener={true}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            style={{ width: size.w, height: size.h }}
            className="hidden md:flex flex-col fixed bottom-24 right-6 z-[70] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden cursor-grab active:cursor-grabbing select-none"
          >
            {/* Scrollable content */}
            <div className="flex-1 overflow-hidden cursor-default" onPointerDown={(e) => e.stopPropagation()}>
              <WalletContent
                status={status} address={address} balance={balance}
                balanceUsd={balanceUsd} solscanUrl={solscanUrl}
                refreshBalance={refreshBalance} isRefreshing={isRefreshing}
                copyAddress={copyAddress} disconnect={disconnect}
                onClose={onClose}
                onAddFunds={() => { setAddFundsOpen(true); onClose(); }}
                onWithdraw={() => { setWithdrawOpen(true); onClose(); }}
              />
            </div>

            {/* Resize handles */}
            {/* Right */}
            <div onMouseDown={(e) => startResize(e, "e")} className="absolute top-4 bottom-4 right-0 w-2 cursor-ew-resize z-10" />
            {/* Left */}
            <div onMouseDown={(e) => startResize(e, "w")} className="absolute top-4 bottom-4 left-0 w-2 cursor-ew-resize z-10" />
            {/* Bottom */}
            <div onMouseDown={(e) => startResize(e, "s")} className="absolute bottom-0 left-4 right-4 h-2 cursor-ns-resize z-10" />
            {/* Top */}
            <div onMouseDown={(e) => startResize(e, "n")} className="absolute top-0 left-4 right-4 h-2 cursor-ns-resize z-10" />
            {/* Corners */}
            <div onMouseDown={(e) => startResize(e, "se")} className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-10" />
            <div onMouseDown={(e) => startResize(e, "sw")} className="absolute bottom-0 left-0 w-4 h-4 cursor-sw-resize z-10" />
            <div onMouseDown={(e) => startResize(e, "ne")} className="absolute top-0 right-0 w-4 h-4 cursor-ne-resize z-10" />
            <div onMouseDown={(e) => startResize(e, "nw")} className="absolute top-0 left-0 w-4 h-4 cursor-nw-resize z-10" />

            {/* Resize indicator di pojok kanan bawah */}
            <div className="absolute bottom-1.5 right-1.5 pointer-events-none opacity-30">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" className="text-muted-foreground">
                <path d="M10 0L0 10h2L10 2V0zM10 4L4 10h2l4-4V4zM10 8L8 10h2V8z"/>
              </svg>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return (
    <>
      {createPortal(content, document.body)}
      <AddFundsModal open={addFundsOpen} onClose={() => setAddFundsOpen(false)} />
      <WithdrawModal open={withdrawOpen} onClose={() => setWithdrawOpen(false)} />
    </>
  );
};

// ── Konten wallet yang sama untuk mobile dan desktop ──
function WalletContent({
  status, address, balance, balanceUsd, solscanUrl,
  refreshBalance, isRefreshing, copyAddress, disconnect,
  onClose, onAddFunds, onWithdraw,
}: any) {
  const navigate = useNavigate();
  const [minimized, setMinimized] = useState(false);
  const [tokens, setTokens] = useState<{ mint: string; symbol: string; name: string; icon: string | null; uiAmount: number; decimals: number; priceUsd: number | null; valueUsd: number | null }[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(false);

  // Fetch token list dari Helius DAS API
  useEffect(() => {
    if (!address || status !== "connected") return;
    let cancelled = false;
    setLoadingTokens(true);
    (async () => {
      try {
        const heliusKey = import.meta.env.VITE_HELIUS_API_KEY;
        if (!heliusKey) return;

        const res = await fetch(
          `https://mainnet.helius-rpc.com/?api-key=${heliusKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: "get-assets",
              method: "getAssetsByOwner",
              params: {
                ownerAddress: address,
                page: 1,
                limit: 100,
                displayOptions: {
                  showFungible: true,
                  showNativeBalance: false,
                },
              },
            }),
          }
        );

        const data = await res.json();
        if (cancelled) return;

        const items = data?.result?.items || [];
        const list = items
          .filter((item: any) =>
            item.interface === "FungibleToken" &&
            item.token_info?.balance > 0
          )
          .map((item: any) => ({
            mint: item.id,
            symbol: item.token_info?.symbol || item.content?.metadata?.symbol || "",
            name: item.content?.metadata?.name || item.token_info?.symbol || item.id.slice(0, 8),
            icon: item.content?.links?.image || null,
            uiAmount: item.token_info?.balance / Math.pow(10, item.token_info?.decimals || 0),
            decimals: item.token_info?.decimals || 0,
            priceUsd: item.token_info?.price_info?.price_per_token || null,
            valueUsd: item.token_info?.price_info?.total_price || null,
          }))
          .filter((t: any) => t.uiAmount > 0)
          .sort((a: any, b: any) => (b.valueUsd || 0) - (a.valueUsd || 0));

        setTokens(list);
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoadingTokens(false);
      }
    })();
    return () => { cancelled = true; };
  }, [address, status]);

  return (
    <div className="px-5 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between py-4 cursor-grab active:cursor-grabbing">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">My Wallet</h2>
          {minimized && balance !== null && (
            <span className="text-xs text-muted-foreground font-mono ml-1">
              {balance.toFixed(4)} SOL
            </span>
          )}
        </div>
        <div className="flex items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
          {/* Minimize / Maximize */}
          <button
            onClick={() => setMinimized(!minimized)}
            className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-muted transition-colors cursor-pointer"
            title={minimized ? "Expand" : "Minimize"}
          >
            {minimized ? (
              <svg className="h-3.5 w-3.5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
              </svg>
            ) : (
              <svg className="h-3.5 w-3.5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
              </svg>
            )}
          </button>
          {/* Close */}
          <button
            onClick={onClose}
            className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Konten — disembunyikan saat minimize */}
      <motion.div
        initial={false}
        animate={{ height: minimized ? 0 : "auto", opacity: minimized ? 0 : 1 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        style={{ overflow: "hidden" }}
      >
        {status !== "connected" ? (
          <div className="py-8 text-center">
            <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-sm text-muted-foreground mb-4">Connect your wallet to view balances</p>
            <WalletConnect variant="default" />
          </div>
        ) : (
          <div className="space-y-4 pb-2">
            {/* Balance Card */}
            <div className="p-5 rounded-xl bg-gradient-to-br from-primary/10 to-transparent border border-primary/20">
              <p className="text-xs text-muted-foreground mb-1">Total Balance</p>
              <div className="text-2xl font-bold text-foreground">
                {balance !== null ? `${balance.toFixed(4)} SOL` : "—"}
              </div>
              {balanceUsd !== null && (
                <p className="text-sm text-muted-foreground">≈ ${balanceUsd.toFixed(2)} USD</p>
              )}
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs font-mono text-muted-foreground">
                  {address ? truncateAddress(address, 6, 4) : ""}
                </span>
                <button onClick={copyAddress} className="h-6 w-6 rounded flex items-center justify-center hover:bg-muted/50 transition-colors">
                  <Copy className="h-3 w-3 text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { icon: <ArrowUpRight className="h-5 w-5" />, label: "Send", onClick: onWithdraw },
                { icon: <ArrowDownLeft className="h-5 w-5" />, label: "Receive", onClick: onAddFunds },
                { icon: <Repeat className="h-5 w-5" />, label: "Swap", onClick: () => {} },
                { icon: <RefreshCw className={`h-5 w-5 ${isRefreshing ? "animate-spin" : ""}`} />, label: "Refresh", onClick: refreshBalance },
              ].map((action) => (
                <button key={action.label} onClick={action.onClick}
                  className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors active:scale-95">
                  <span className="text-primary">{action.icon}</span>
                  <span className="text-xs text-foreground font-medium">{action.label}</span>
                </button>
              ))}
            </div>

            {/* Token List */}
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Tokens</p>
              {loadingTokens ? (
                <div className="flex items-center justify-center py-4">
                  <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : tokens.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3">No tokens found</p>
              ) : (
                <div className="space-y-1">
                  {tokens.map((t) => (
                    <div
                      key={t.mint}
                      onClick={() => { navigate(`/market?token=${t.mint}`); onClose(); }}
                      className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-muted/40 transition-colors cursor-pointer"
                    >
                      {/* Icon */}
                      <div className="h-10 w-10 rounded-full bg-muted border border-border flex items-center justify-center shrink-0 overflow-hidden">
                        {t.icon
                          ? <img src={t.icon} alt="" className="h-full w-full object-cover"
                              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                          : <span className="text-[10px] font-bold text-primary">{(t.symbol || t.name).slice(0, 2).toUpperCase()}</span>
                        }
                      </div>

                      {/* Left: name + amount */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-foreground truncate">{t.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {t.uiAmount.toLocaleString("en-US", { maximumFractionDigits: 6 })} {t.symbol}
                        </div>
                      </div>

                      {/* Right: USD value */}
                      <div className="text-right shrink-0">
                        <div className="text-sm font-semibold text-foreground">
                          {t.valueUsd != null ? `$${t.valueUsd.toFixed(2)}` : "—"}
                        </div>
                        {t.priceUsd != null && (
                          <div className="text-xs text-muted-foreground">
                            ${t.priceUsd < 0.0001
                              ? t.priceUsd.toExponential(2)
                              : t.priceUsd.toFixed(t.priceUsd < 0.01 ? 6 : 4)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* View on Solscan */}
            {solscanUrl && (
              <button onClick={() => window.open(solscanUrl, "_blank")}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors">
                <ExternalLink className="h-4 w-4" />
                View on Solscan
              </button>
            )}

            {/* Log out */}
            <button
              onClick={() => { disconnect(); onClose(); }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function QuickAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <button onClick={onClick}
      className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors active:scale-95">
      <span className="text-primary">{icon}</span>
      <span className="text-xs text-foreground font-medium">{label}</span>
    </button>
  );
}

export default WalletDrawer;