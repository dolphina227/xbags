import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, Wallet, ArrowRight, Copy, Check, ExternalLink,
  AlertCircle, CheckCircle2, Clock, Users, TrendingUp,
  Shield, Lock, Info, RefreshCw, ChevronDown, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/hooks/use-wallet";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

// ─── Presale Config ───────────────────────────────────────────────────────────
const PRESALE_WALLET = "REPLACE_WITH_YOUR_PRESALE_WALLET_ADDRESS"; // ← ganti dengan wallet presale Anda
const SOL_PER_XBAGS  = 1 / 8000;          // 1 SOL = 8,000 XBAGS
const XBAGS_PER_SOL  = 8000;
const MIN_SOL        = 0.1;
const MAX_SOL        = 5;
const HARDCAP_SOL    = 5000;               // 40M tokens ÷ 8000 = 5000 SOL (hidden from UI)
const SOFTCAP_USD    = 5000;               // $5,000 softcap — displayed in USD
const TOTAL_TOKENS   = 40_000_000;        // 40M presale allocation
const LAMPORTS       = 1_000_000_000;

// ─── Types ────────────────────────────────────────────────────────────────────
interface PresaleStats {
  total_sol_raised: number;
  total_participants: number;
  total_tokens_sold: number;
  is_active: boolean;
  ends_at: string | null;
}

interface MyContribution {
  total_sol: number;
  total_tokens: number;
  tx_count: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtSol(n: number) { return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }); }
function fmtNum(n: number) { return n.toLocaleString(); }

function ProgressBar({ value, max, soft }: { value: number; max: number; soft: number }) {
  const pct     = Math.min((value / max) * 100, 100);
  const softPct = Math.min((soft / max) * 100, 100);
  return (
    <div className="relative h-3 w-full rounded-full bg-white/[0.06] overflow-hidden">
      <motion.div
        className="absolute left-0 top-0 h-full rounded-full bg-primary"
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 1, ease: "easeOut" }}
      />
      {/* Softcap marker */}
      <div
        className="absolute top-0 h-full w-0.5 bg-yellow-400/60"
        style={{ left: `${softPct}%` }}
      />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PresalePage() {
  const { status, address, balance, sendTransaction } = useWallet();
  const navigate = useNavigate();

  const [solPrice, setSolPrice]      = useState<number>(0);
  const [stats, setStats]           = useState<PresaleStats | null>(null);
  const [myContrib, setMyContrib]   = useState<MyContribution | null>(null);
  const [solAmount, setSolAmount]   = useState("");
  const [step, setStep]             = useState<"input" | "confirm" | "success">("input");
  const [loading, setLoading]       = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);
  const [txSig, setTxSig]           = useState<string | null>(null);
  const [copied, setCopied]         = useState(false);
  const [faqOpen, setFaqOpen]       = useState<number | null>(null);

  const solNum       = parseFloat(solAmount) || 0;
  const xbagsNum     = solNum * XBAGS_PER_SOL;
  // Softcap in SOL = $5000 / live SOL price (fallback 120 if price not loaded)
  const softcapSol   = solPrice > 0 ? SOFTCAP_USD / solPrice : SOFTCAP_USD / 120;
  const raisedUsd    = solPrice > 0 ? (stats?.total_sol_raised ?? 0) * solPrice : 0;
  const pctSold      = stats ? Math.min((stats.total_sol_raised / HARDCAP_SOL) * 100, 100) : 0;
  const isSoftcap    = stats ? raisedUsd >= SOFTCAP_USD : false;
  const isFull       = stats ? stats.total_sol_raised >= HARDCAP_SOL : false;

  // Validation
  const validationError = (() => {
    if (!solAmount) return null;
    if (solNum < MIN_SOL) return `Minimum ${MIN_SOL} SOL`;
    if (solNum > MAX_SOL) return `Maximum ${MAX_SOL} SOL per wallet`;
    if (balance !== null && solNum > balance - 0.001) return "Insufficient balance";
    if (isFull) return "Hardcap reached — presale ended";
    return null;
  })();

  // Fetch live SOL price from DexScreener (free, no key needed)
  const fetchSolPrice = useCallback(async () => {
    try {
      const res = await fetch(
        "https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112",
        { signal: AbortSignal.timeout(6000) }
      );
      const data = await res.json();
      const pairs: any[] = data?.pairs ?? [];
      // Pick USDC or USDT pair with highest liquidity
      const stable = pairs
        .filter(p => ["usdc","usdt"].some(s => p.quoteToken?.symbol?.toLowerCase().includes(s)))
        .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
      const price = parseFloat(stable?.priceUsd ?? "0");
      if (price > 0) setSolPrice(price);
    } catch { /* keep last known price */ }
  }, []);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("presale_stats" as any)
        .select("*")
        .single();
      if (data) setStats(data as any);
    } catch {
      // Table might not exist yet — show placeholder
      setStats({
        total_sol_raised: 0,
        total_participants: 0,
        total_tokens_sold: 0,
        is_active: true,
        ends_at: null,
      });
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Fetch my contributions
  const fetchMyContrib = useCallback(async () => {
    if (!address) return;
    try {
      const { data } = await supabase
        .from("presale_purchases" as any)
        .select("sol_amount, tokens_amount")
        .eq("wallet_address", address);
      if (data && (data as any[]).length > 0) {
        const rows = data as any[];
        setMyContrib({
          total_sol:    rows.reduce((s, r) => s + Number(r.sol_amount), 0),
          total_tokens: rows.reduce((s, r) => s + Number(r.tokens_amount), 0),
          tx_count:     rows.length,
        });
      }
    } catch { /* table not created yet */ }
  }, [address]);

  useEffect(() => { fetchSolPrice(); }, [fetchSolPrice]);
  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchMyContrib(); }, [fetchMyContrib]);
  // Refresh SOL price every 30 seconds
  useEffect(() => {
    const t = setInterval(fetchSolPrice, 30000);
    return () => clearInterval(t);
  }, [fetchSolPrice]);

  // Buy handler
  const handleBuy = async () => {
    if (!address || !solNum || validationError) return;
    setLoading(true);
    try {
      // 1. Send SOL to presale wallet
      const sig = await sendTransaction(PRESALE_WALLET, solNum);
      if (!sig) throw new Error("Transaction cancelled or failed");

      setTxSig(sig);

      // 2. Save to database
      await supabase.from("presale_purchases" as any).insert({
        wallet_address: address,
        sol_amount:     solNum,
        tokens_amount:  xbagsNum,
        tx_hash:        sig,
        status:         "confirmed",
      });

      // 3. Update step & refresh
      setStep("success");
      setSolAmount("");
      fetchStats();
      fetchMyContrib();

      toast.success("Purchase recorded!", {
        description: `${fmtNum(xbagsNum)} XBAGS will be distributed after presale ends.`,
      });
    } catch (err: any) {
      toast.error("Transaction failed", { description: err?.message });
    } finally {
      setLoading(false);
    }
  };

  const copyWallet = () => {
    navigator.clipboard.writeText(PRESALE_WALLET);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const FAQS = [
    {
      q: "When will tokens be distributed?",
      a: "XBAGS tokens will be distributed to all presale participants simultaneously after the presale ends (hardcap reached or end date). You don't need to do anything — tokens will be sent directly to your wallet.",
    },
    {
      q: "What happens if softcap isn't reached?",
      a: "If the softcap (~42 SOL) is not reached by the end date, all participants will receive a full refund to their wallet address.",
    },
    {
      q: "Can I buy multiple times?",
      a: `Yes, but the total across all purchases cannot exceed ${MAX_SOL} SOL per wallet. Each purchase is recorded separately.`,
    },
    {
      q: "Is there a vesting period for presale tokens?",
      a: "No vesting for presale buyers — tokens are fully unlocked at TGE. Team tokens are locked for 12 months with 6-month linear vesting.",
    },
    {
      q: "Which wallet should I use?",
      a: "Any Solana wallet connected to xBAGS — Phantom, Solflare, or Backpack. The tokens will be sent to the same wallet you purchase from.",
    },
  ];

  return (
    <div className="container mx-auto max-w-2xl px-4 py-6 pb-24 md:pb-8 space-y-5">

      {/* Header */}
      <div className="text-center pt-2 pb-1">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-4">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
          </span>
          <span className="text-xs font-mono font-semibold text-primary">PRESALE LIVE</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">$XBAGS Token Presale</h1>
        <p className="text-sm text-muted-foreground mt-1">1 SOL = {fmtNum(XBAGS_PER_SOL)} XBAGS · Min {MIN_SOL} SOL · Max {MAX_SOL} SOL</p>
      </div>

      {/* Progress Card */}
      <div className="p-5 rounded-2xl bg-card border border-border space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-mono">TOTAL RAISED</p>
            <p className="text-xl font-bold font-mono text-foreground">
              {statsLoading ? "—" : `${fmtSol(stats?.total_sol_raised ?? 0)} SOL`}
            </p>
            {solPrice > 0 && (
              <p className="text-sm text-muted-foreground font-mono">
                ≈ ${raisedUsd > 0 ? raisedUsd.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "0"}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground font-mono">SOL PRICE</p>
            <p className="text-xl font-bold font-mono text-foreground">
              {solPrice > 0 ? `$${solPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—"}
            </p>
            <p className="text-[10px] text-muted-foreground font-mono">live price</p>
          </div>
        </div>

        <ProgressBar
          value={stats?.total_sol_raised ?? 0}
          max={HARDCAP_SOL}
          soft={softcapSol}
        />

        <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
          <span className="text-yellow-400/80 flex items-center gap-1">
            <div className="h-1.5 w-0.5 bg-yellow-400/60 inline-block" />
            Softcap $5,000
            {isSoftcap && <CheckCircle2 className="h-3 w-3 text-emerald-400 ml-1" />}
          </span>
          <span className={`font-semibold ${pctSold > 80 ? "text-orange-400" : "text-primary"}`}>
            {pctSold.toFixed(2)}% filled
          </span>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          {[
            { label: "Participants", value: statsLoading ? "—" : fmtNum(stats?.total_participants ?? 0), icon: Users },
            { label: "Tokens Sold", value: statsLoading ? "—" : `${((stats?.total_tokens_sold ?? 0) / 1_000_000).toFixed(1)}M`, icon: TrendingUp },
            { label: "Remaining", value: statsLoading ? "—" : `${((TOTAL_TOKENS - (stats?.total_tokens_sold ?? 0)) / 1_000_000).toFixed(1)}M`, icon: Zap },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="text-center p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <Icon className="h-3.5 w-3.5 text-muted-foreground mx-auto mb-1" />
              <p className="text-sm font-bold font-mono text-foreground">{value}</p>
              <p className="text-[10px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* My Contribution */}
      {myContrib && myContrib.total_sol > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-primary/8 border border-primary/20 flex items-center gap-4"
        >
          <div className="h-10 w-10 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
            <Wallet className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">Your contribution</p>
            <p className="text-sm font-bold font-mono text-primary">
              {fmtSol(myContrib.total_sol)} SOL → {fmtNum(myContrib.total_tokens)} XBAGS
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] text-muted-foreground">{myContrib.tx_count} tx</p>
            <p className="text-[10px] text-muted-foreground">Pending TGE</p>
          </div>
        </motion.div>
      )}

      {/* Buy Card */}
      {status !== "connected" ? (
        <div className="p-6 rounded-2xl bg-card border border-border text-center space-y-4">
          <Wallet className="h-10 w-10 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">Connect your Solana wallet to participate</p>
          <Button onClick={() => navigate("/feed")} className="bg-primary text-primary-foreground">
            Connect Wallet
          </Button>
        </div>
      ) : isFull ? (
        <div className="p-6 rounded-2xl bg-card border border-orange-400/20 text-center space-y-2">
          <CheckCircle2 className="h-10 w-10 text-orange-400 mx-auto" />
          <p className="text-base font-semibold text-orange-400">Hardcap Reached!</p>
          <p className="text-sm text-muted-foreground">Presale has ended. Token distribution coming soon.</p>
        </div>
      ) : (
        <div className="p-5 rounded-2xl bg-card border border-border space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Buy $XBAGS</h2>

          <AnimatePresence mode="wait">
            {step === "input" && (
              <motion.div key="input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                {/* SOL Input */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs text-muted-foreground font-mono">YOU SEND</label>
                    {balance !== null && (
                      <span className="text-[11px] text-muted-foreground font-mono">
                        Balance: {fmtSol(balance)} SOL
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      type="number"
                      placeholder="0.0"
                      value={solAmount}
                      onChange={e => setSolAmount(e.target.value)}
                      min={MIN_SOL}
                      max={MAX_SOL}
                      step="0.1"
                      className="font-mono text-lg bg-muted/50 border-border pr-20 focus:border-primary h-12"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      <button
                        onClick={() => setSolAmount(String(MAX_SOL))}
                        className="text-[10px] font-bold text-primary hover:text-primary/80 transition-colors"
                      >
                        MAX
                      </button>
                      <span className="text-sm font-semibold text-foreground">SOL</span>
                    </div>
                  </div>
                  {validationError && (
                    <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />{validationError}
                    </p>
                  )}
                </div>

                {/* Arrow */}
                <div className="flex items-center justify-center">
                  <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <ArrowRight className="h-4 w-4 text-primary" />
                  </div>
                </div>

                {/* XBAGS Output */}
                <div>
                  <label className="text-xs text-muted-foreground font-mono block mb-1.5">YOU RECEIVE</label>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border h-12">
                    <span className="font-mono text-lg font-bold text-primary">
                      {solNum > 0 ? fmtNum(xbagsNum) : "0"}
                    </span>
                    <span className="text-sm font-semibold text-foreground">XBAGS</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1 font-mono text-right">
                    Rate: 1 SOL = {fmtNum(XBAGS_PER_SOL)} XBAGS
                  </p>
                </div>

                {/* Quick amounts */}
                <div className="flex gap-2">
                  {[0.1, 0.5, 1, 2, 5].map(v => (
                    <button
                      key={v}
                      onClick={() => setSolAmount(String(v))}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-semibold transition-colors border ${
                        solNum === v
                          ? "bg-primary/15 border-primary/30 text-primary"
                          : "bg-white/[0.03] border-white/[0.06] text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>

                <Button
                  onClick={() => setStep("confirm")}
                  disabled={!solNum || !!validationError}
                  className="w-full h-12 bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90"
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Buy {solNum > 0 ? `${fmtNum(xbagsNum)} XBAGS` : "XBAGS"}
                </Button>
              </motion.div>
            )}

            {step === "confirm" && (
              <motion.div key="confirm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">You send</span>
                    <span className="font-mono font-bold text-foreground">{fmtSol(solNum)} SOL</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">You receive</span>
                    <span className="font-mono font-bold text-primary">{fmtNum(xbagsNum)} XBAGS</span>
                  </div>
                  <div className="flex justify-between text-sm border-t border-border pt-3">
                    <span className="text-muted-foreground">Presale wallet</span>
                    <div className="flex items-center gap-1.5">
                      <code className="text-xs font-mono text-foreground/70">
                        {PRESALE_WALLET.slice(0, 8)}...{PRESALE_WALLET.slice(-6)}
                      </code>
                      <button onClick={copyWallet} className="text-muted-foreground/40 hover:text-primary transition-colors">
                        {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Distribution</span>
                    <span className="text-xs text-muted-foreground">After presale ends</span>
                  </div>
                </div>

                <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-400/8 border border-yellow-400/20">
                  <Info className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-yellow-400/90 leading-relaxed">
                    This sends SOL directly to the presale wallet. Tokens will be distributed to your wallet after presale ends.
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep("input")} disabled={loading} className="flex-1 border-border">
                    Back
                  </Button>
                  <Button onClick={handleBuy} disabled={loading} className="flex-1 bg-primary text-primary-foreground font-bold">
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Confirming...
                      </span>
                    ) : (
                      <>Confirm & Send</>
                    )}
                  </Button>
                </div>
              </motion.div>
            )}

            {step === "success" && txSig && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center space-y-4 py-2"
              >
                <div className="h-16 w-16 rounded-full bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                </div>
                <div>
                  <p className="text-base font-bold text-foreground">Purchase Complete!</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your XBAGS tokens are reserved and will be distributed after presale ends.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-muted/30 border border-border space-y-1 text-left">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tokens reserved</span>
                    <span className="font-mono font-bold text-primary">{fmtNum(xbagsNum)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">TX Hash</span>
                    <a
                      href={`https://solscan.io/tx/${txSig}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-xs font-mono text-primary/70 hover:text-primary flex items-center gap-1"
                    >
                      {txSig.slice(0, 12)}... <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
                <Button onClick={() => setStep("input")} className="w-full bg-primary text-primary-foreground">
                  Buy More
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Tokenomics Card */}
      <div className="p-5 rounded-2xl bg-card border border-border space-y-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Tokenomics
        </h2>
        <div className="space-y-2">
          {[
            { label: "Presale",          pct: 40, amount: "40M", color: "bg-blue-400",   desc: "Public sale" },
            { label: "Rewards & Airdrop",pct: 25, amount: "25M", color: "bg-yellow-400", desc: "Creator rewards, referrals" },
            { label: "Liquidity Pool",   pct: 20, amount: "20M", color: "bg-emerald-400",desc: "DEX liquidity at TGE" },
            { label: "Team",             pct: 10, amount: "10M", color: "bg-pink-400",   desc: "12mo lock + 6mo vesting" },
            { label: "Reserve",          pct:  5, amount:  "5M", color: "bg-slate-400",  desc: "Dev & partnerships" },
          ].map(row => (
            <div key={row.label} className="flex items-center gap-3">
              <div className="flex items-center gap-2 w-36 shrink-0">
                <div className={`h-2 w-2 rounded-full ${row.color} shrink-0`} />
                <span className="text-xs text-foreground truncate">{row.label}</span>
              </div>
              <div className="flex-1 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                <div className={`h-full ${row.color} rounded-full`} style={{ width: `${row.pct}%` }} />
              </div>
              <span className="text-xs font-mono text-muted-foreground w-8 text-right">{row.pct}%</span>
              <span className="text-xs font-mono text-muted-foreground w-10 text-right">{row.amount}</span>
            </div>
          ))}
        </div>
        <div className="pt-1 flex items-center gap-2">
          <Lock className="h-3.5 w-3.5 text-pink-400" />
          <span className="text-[11px] text-muted-foreground font-mono">
            Team tokens locked 12 months · Total supply 100,000,000 XBAGS
          </span>
        </div>
      </div>

      {/* Security note */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
        <Shield className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-xs font-semibold text-foreground">How it works</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Send SOL directly to the presale wallet. Your purchase is recorded on-chain and in our database.
            After presale ends (hardcap reached or end date), tokens are distributed simultaneously to all participants.
          </p>
        </div>
      </div>

      {/* FAQ */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-foreground">FAQ</h2>
        {FAQS.map((faq, i) => (
          <div key={i} className="rounded-xl bg-card border border-border overflow-hidden">
            <button
              onClick={() => setFaqOpen(faqOpen === i ? null : i)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors"
            >
              <span className="text-sm font-medium text-foreground">{faq.q}</span>
              {faqOpen === i
                ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
              }
            </button>
            <AnimatePresence>
              {faqOpen === i && (
                <motion.div
                  initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
                  className="overflow-hidden"
                >
                  <p className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed border-t border-border pt-3">
                    {faq.a}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>

    </div>
  );
}