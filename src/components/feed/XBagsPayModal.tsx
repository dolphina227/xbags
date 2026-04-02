/**
 * src/components/feed/XBagsPayModal.tsx
 *
 * Modal pembayaran xBAGS untuk:
 *  - Tip creator
 *  - Super Like
 *  - Unlock premium content
 *
 * Jika token belum live (VITE_XBAGS_TOKEN_ADDRESS belum diset),
 * modal menampilkan pesan "Coming Soon" tanpa crash.
 * Tidak mengubah use-wallet.tsx atau file lain yang sudah berjalan.
 */

import { useState, useEffect } from "react";
import { Loader2, Zap, Diamond, Lock, Coins } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/hooks/use-wallet";
import { useWallet as useSolanaAdapter, useConnection } from "@solana/wallet-adapter-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  XBAGS_TOKEN_LIVE,
  XBAGS_TIP_PRESETS,
  XBAGS_PRICES,
  getXBagsBalance,
  buildXBagsTransferTx,
} from "@/lib/xbags-token";

// ─── Types ───────────────────────────────────────────────────────────────────

export type PayMode = "tip" | "super_like" | "unlock";

interface XBagsPayModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: PayMode;

  // Untuk tip & super like
  recipientWallet?: string;
  recipientName?: string;
  recipientUsername?: string | null;

  // Untuk unlock premium content
  postId?: string;
  unlockPriceXbags?: number;
  onUnlocked?: () => void;

  // Untuk super like
  postIdForSuperLike?: string;
  onSuperLiked?: () => void;
}

// ─── Mode config ─────────────────────────────────────────────────────────────

const MODE_CONFIG: Record<PayMode, {
  icon: React.ReactNode;
  title: string;
  color: string;
  bgColor: string;
}> = {
  tip: {
    icon: <Diamond className="h-5 w-5" />,
    title: "Send Tip",
    color: "text-warning",
    bgColor: "bg-warning/10",
  },
  super_like: {
    icon: <Zap className="h-5 w-5" />,
    title: "Super Like",
    color: "text-primary",
    bgColor: "bg-primary/10",
  },
  unlock: {
    icon: <Lock className="h-5 w-5" />,
    title: "Unlock Content",
    color: "text-info",
    bgColor: "bg-info/10",
  },
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function XBagsPayModal({
  isOpen,
  onClose,
  mode,
  recipientWallet,
  recipientName,
  recipientUsername,
  postId,
  unlockPriceXbags,
  onUnlocked,
  postIdForSuperLike,
  onSuperLiked,
}: XBagsPayModalProps) {
  const { status, address, publicKey } = useWallet();
  const { connection } = useConnection();
  const solanaWallet = useSolanaAdapter(); // untuk signTransaction

  const [amount, setAmount] = useState<number>(
    mode === "unlock"
      ? (unlockPriceXbags ?? XBAGS_PRICES.UNLOCK_MIN)
      : mode === "super_like"
      ? XBAGS_PRICES.SUPER_LIKE
      : XBAGS_PRICES.TIP_DEFAULT
  );
  const [xbagsBalance, setXbagsBalance] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [xbagsPrice, setXbagsPrice] = useState<number | null>(null);

  // Fetch harga xBAGS dari Helius
  useEffect(() => {
    const tokenAddress = import.meta.env.VITE_XBAGS_TOKEN_ADDRESS;
    if (!tokenAddress) return;
    const apiKey = import.meta.env.VITE_HELIUS_API_KEY;
    if (!apiKey) return;
    fetch(`https://mainnet.helius-rpc.com/?api-key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: "xbags-price", method: "getAsset",
        params: { id: tokenAddress },
      }),
    })
      .then(r => r.json())
      .then(d => {
        const price = d?.result?.token_info?.price_info?.price_per_token;
        if (price && price > 0) setXbagsPrice(price);
      })
      .catch(() => {});
  }, []);

  const cfg = MODE_CONFIG[mode];

  // Fetch xBAGS balance saat modal dibuka
  useEffect(() => {
    if (!isOpen || !XBAGS_TOKEN_LIVE || !publicKey) return;
    setLoadingBalance(true);
    getXBagsBalance(connection, publicKey)
      .then(setXbagsBalance)
      .catch(() => setXbagsBalance(0))
      .finally(() => setLoadingBalance(false));
  }, [isOpen, publicKey, connection]);

  // Sync amount saat mode/props berubah
  useEffect(() => {
    if (mode === "unlock") setAmount(unlockPriceXbags ?? XBAGS_PRICES.UNLOCK_MIN);
    else if (mode === "super_like") setAmount(XBAGS_PRICES.SUPER_LIKE);
    else setAmount(XBAGS_PRICES.TIP_DEFAULT);
  }, [mode, unlockPriceXbags]);

  const insufficient = xbagsBalance !== null && amount > xbagsBalance;

  // ── Handle Send ────────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!XBAGS_TOKEN_LIVE) return;
    if (status !== "connected" || !publicKey || !solanaWallet.signTransaction) {
      toast.error("Connect wallet first");
      return;
    }
    if (amount <= 0) { toast.error("Enter a valid amount"); return; }
    if (insufficient) { toast.error("Insufficient xBAGS balance"); return; }

    const targetWallet = recipientWallet;
    if ((mode === "tip" || mode === "super_like") && !targetWallet) {
      toast.error("Recipient wallet not found");
      return;
    }

    setSending(true);
    try {
      const tx = await buildXBagsTransferTx(
        connection,
        publicKey,
        targetWallet!,
        amount,
      );

      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;

      const signed    = await solanaWallet.signTransaction(tx);
      const signature = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(signature, "confirmed");

      const txLink = {
        label: "View TX",
        onClick: () => window.open(`https://solscan.io/tx/${signature}`, "_blank"),
      };

      if (mode === "tip") {
        // Log ke Supabase — silent fail jika tabel belum ada
        supabase.from("xbags_tips" as any).insert({
          sender_wallet:    address,
          recipient_wallet: targetWallet,
          amount_xbags:     amount,
          message:          message || null,
          tx_signature:     signature,
        }).then(() => {});

        toast.success(
          `Tipped ${amount.toLocaleString()} xBAGS to ${recipientUsername ? `@${recipientUsername}` : recipientName}! 💎`,
          { action: txLink }
        );
      }

      if (mode === "super_like") {
        supabase.from("xbags_super_likes" as any).insert({
          post_id:          postIdForSuperLike,
          sender_wallet:    address,
          recipient_wallet: targetWallet,
          amount_xbags:     amount,
          tx_signature:     signature,
        }).then(() => {});

        toast.success(`Super Like sent! ⚡ ${amount} xBAGS`, { action: txLink });
        onSuperLiked?.();
      }

      if (mode === "unlock") {
        if (postId) {
          await supabase.from("post_unlocks").insert({
            post_id:               postId,
            user_wallet:           address!,
            amount_sol:            0,
            transaction_signature: signature,
          });
        }
        toast.success("Content unlocked! 🔓", { action: txLink });
        onUnlocked?.();
      }

      // Refresh balance
      if (publicKey) {
        getXBagsBalance(connection, publicKey).then(setXbagsBalance).catch(() => {});
      }

      onClose();
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("User rejected") || msg.includes("rejected")) {
        toast.error("Transaction cancelled");
      } else {
        toast.error("Transaction failed", { description: msg.slice(0, 120) });
      }
    } finally {
      setSending(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className={`flex items-center gap-2 ${cfg.color}`}>
            <span className={`p-1.5 rounded-lg ${cfg.bgColor}`}>{cfg.icon}</span>
            {cfg.title}
            {(recipientUsername || recipientName) && mode !== "unlock" && (
              <span className="text-foreground font-normal text-sm ml-1">
                to {recipientUsername ? `@${recipientUsername}` : recipientName}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">

          {/* Token belum live — Coming Soon */}
          {!XBAGS_TOKEN_LIVE ? (
            <div className="text-center py-8 space-y-3">
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Coins className="h-7 w-7 text-primary" />
              </div>
              <div>
                <p className="font-bold text-foreground">$xBAGS Token</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Launching soon. This feature will be active after the TGE.
                </p>
              </div>
              <Button variant="outline" onClick={onClose} className="w-full">
                Close
              </Button>
            </div>
          ) : (
            <>
              {/* xBAGS Balance */}
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/40 border border-border">
                <span className="text-xs text-muted-foreground">Your xBAGS balance</span>
                <span className="text-sm font-bold text-primary font-mono">
                  {loadingBalance ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin inline" />
                  ) : xbagsBalance !== null ? (
                    xbagsBalance.toLocaleString()
                  ) : "—"}
                </span>
              </div>

              {/* Amount input — hanya tip yang adjustable */}
              {mode === "tip" ? (
                <>
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Quick amounts</p>
                    <div className="grid grid-cols-4 gap-2">
                      {XBAGS_TIP_PRESETS.map((qa) => (
                        <button
                          key={qa}
                          onClick={() => setAmount(qa)}
                          className={`py-2 rounded-lg text-xs font-semibold transition-all ${
                            amount === qa
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                        >
                          {qa}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Custom amount</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(Math.max(1, parseFloat(e.target.value) || 0))}
                        className="flex-1 bg-muted rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
                        min="1"
                      />
                      <span className="text-sm font-semibold text-primary">xBAGS</span>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Message (optional)</p>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Great content! 🔥"
                      className="w-full bg-muted rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none focus:ring-1 focus:ring-primary"
                      rows={2}
                      maxLength={140}
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Quick amounts</p>
                    <div className="grid grid-cols-4 gap-2">
                      {[50, 100, 500, 1000].map((qa) => (
                        <button key={qa} onClick={() => setAmount(qa)}
                          className={`py-2 rounded-lg text-xs font-semibold transition-all ${amount === qa ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                          {qa}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Custom amount</p>
                    <div className="flex items-center gap-2">
                      <input type="number" value={amount}
                        onChange={(e) => setAmount(Math.max(1, parseFloat(e.target.value) || 0))}
                        className="flex-1 bg-muted rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
                        min="1" />
                      <span className="text-sm font-semibold text-primary">xBAGS</span>
                    </div>
                    {xbagsPrice && (
                      <p className="text-xs text-muted-foreground mt-1">
                        approx ${(amount * xbagsPrice).toFixed(4)} USD
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    {mode === "super_like" ? "Sent directly to the creator" : "Unlock once, access forever"}
                  </p>
                </div>
              )}

              {/* Insufficient warning */}
              {insufficient && (
                <div className="px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                  xBAGS balance is insufficient. Need to top up {amount.toLocaleString()} xBAGS.
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="flex-1"
                  disabled={sending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSend}
                  className={`flex-1 ${cfg.buttonColor}`}
                  disabled={sending || insufficient || !publicKey}
                >
                  {sending ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" />Processing...</>
                  ) : (
                    <>{cfg.icon}<span className="ml-1">{cfg.buttonLabel}</span></>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
