import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Coins, Search, RefreshCw, ExternalLink, Loader2,
  ChevronDown, ChevronUp, AlertCircle, CheckCircle2,
  Wallet, Copy, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/hooks/use-wallet";
import { supabase } from "@/integrations/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FeePosition {
  tokenAddress: string;
  tokenName: string;
  tokenSymbol: string;
  tokenIcon: string | null;
  unclaimedSol: number;      // SOL yang belum di-claim
  unclaimedUsd: number;      // USD value
  platform: "bags" | "pump" | "bonk";
  poolAddress?: string;
  positionType?: string;     // virtual, damm, custom_vault
  claimable: boolean;
}

interface PlatformResult {
  platform: "bags" | "pump" | "bonk";
  positions: FeePosition[];
  totalSol: number;
  totalUsd: number;
  loading: boolean;
  error: string | null;
  scanned: boolean;
}

interface ClaimStatus {
  tokenAddress: string;
  status: "idle" | "claiming" | "success" | "error";
  txHash?: string;
  error?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SOL_PRICE_USD = 150; // fallback, idealnya fetch dari API
const LAMPORTS_PER_SOL = 1_000_000_000;

const PLATFORM_META = {
  bags: {
    label:    "Bags.fm",
    color:    "text-primary",
    bg:       "bg-primary/10",
    border:   "border-primary/20",
    gradient: "from-primary/5",
    icon:     "🛍️",
    desc:     "Creator fees dari token launches di Bags.fm",
    url:      (addr: string) => `https://bags.fm/token/${addr}`,
  },
  pump: {
    label:    "Pump.fun",
    color:    "text-emerald-400",
    bg:       "bg-emerald-400/10",
    border:   "border-emerald-400/20",
    gradient: "from-emerald-400/5",
    icon:     "⚡",
    desc:     "Creator fees dari bonding curve & PumpSwap",
    url:      (addr: string) => `https://pump.fun/coin/${addr}`,
  },
  bonk: {
    label:    "Bonk.fun",
    color:    "text-orange-400",
    bg:       "bg-orange-400/10",
    border:   "border-orange-400/20",
    gradient: "from-orange-400/5",
    icon:     "🦊",
    desc:     "Creator fees dari Raydium LaunchLab",
    url:      (addr: string) => `https://letsbonk.fun/token/${addr}`,
  },
};

// ─── Helper ───────────────────────────────────────────────────────────────────

function formatSol(sol: number): string {
  if (sol === 0) return "0 SOL";
  if (sol < 0.001) return `${(sol * 1000).toFixed(3)} mSOL`;
  if (sol < 1) return `${sol.toFixed(4)} SOL`;
  return `${sol.toFixed(3)} SOL`;
}

function formatUsd(usd: number): string {
  if (usd < 0.01) return "<$0.01";
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}

function truncAddr(addr: string, head = 6, tail = 4): string {
  if (!addr || addr.length < head + tail) return addr;
  return `${addr.slice(0, head)}...${addr.slice(-tail)}`;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function UnclaimedFeesPage() {
  const { status, address } = useWallet();

  const [inputQuery, setInputQuery] = useState("");
  const [scanQuery, setScanQuery]   = useState("");  // query yang aktif discan
  const [scanning, setScanning]     = useState(false);
  const [scanned, setScanned]       = useState(false);

  const [platforms, setPlatforms] = useState<Record<string, PlatformResult>>({
    bags: { platform: "bags", positions: [], totalSol: 0, totalUsd: 0, loading: false, error: null, scanned: false },
    pump: { platform: "pump", positions: [], totalSol: 0, totalUsd: 0, loading: false, error: null, scanned: false },
    bonk: { platform: "bonk", positions: [], totalSol: 0, totalUsd: 0, loading: false, error: null, scanned: false },
  });

  const [activeTab, setActiveTab]   = useState<"bags" | "pump" | "bonk">("bags");
  const [expanded, setExpanded]     = useState<Set<string>>(new Set());
  const [claimStatus, setClaimStatus] = useState<Record<string, ClaimStatus>>({});
  const [copied, setCopied]         = useState(false);

  // ── Scan fees ──────────────────────────────────────────────────────────────
  const scan = useCallback(async (query: string) => {
    if (!query.trim()) return;
    setScanQuery(query.trim());
    setScanning(true);
    setScanned(false);

    // Reset semua platform
    setPlatforms(prev => Object.fromEntries(
      Object.entries(prev).map(([k, v]) => [k, { ...v, loading: true, error: null, scanned: false, positions: [], totalSol: 0, totalUsd: 0 }])
    ) as any);

    // Scan semua platform paralel
    const scanPlatform = async (platform: "bags" | "pump" | "bonk") => {
      try {
        const { data, error } = await supabase.functions.invoke("claim-fees", {
          body: { action: "scan", platform, query: query.trim() },
        });
        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || "Scan failed");

        const positions: FeePosition[] = (data.positions ?? []).map((p: any) => ({
          tokenAddress: p.tokenAddress,
          tokenName:    p.tokenName    || "Unknown Token",
          tokenSymbol:  p.tokenSymbol  || "???",
          tokenIcon:    p.tokenIcon    || null,
          unclaimedSol: p.unclaimedLamports ? p.unclaimedLamports / LAMPORTS_PER_SOL : (p.unclaimedSol ?? 0),
          unclaimedUsd: p.unclaimedUsd ?? ((p.unclaimedLamports ?? 0) / LAMPORTS_PER_SOL * SOL_PRICE_USD),
          platform,
          poolAddress:  p.poolAddress  || p.virtualPoolAddress || null,
          positionType: p.positionType || "virtual",
          claimable:    p.claimable    ?? true,
        }));

        const totalSol = positions.reduce((s, p) => s + p.unclaimedSol, 0);
        const totalUsd = positions.reduce((s, p) => s + p.unclaimedUsd, 0);

        setPlatforms(prev => ({
          ...prev,
          [platform]: { platform, positions, totalSol, totalUsd, loading: false, error: null, scanned: true },
        }));
      } catch (err: any) {
        setPlatforms(prev => ({
          ...prev,
          [platform]: { ...prev[platform], loading: false, error: err.message || "Scan failed", scanned: true },
        }));
      }
    };

    await Promise.all([
      scanPlatform("bags"),
      scanPlatform("pump"),
      scanPlatform("bonk"),
    ]);

    setScanning(false);
    setScanned(true);
  }, []);

  // Auto-scan dari wallet yang terconnect
  const scanFromWallet = useCallback(() => {
    if (!address) return;
    setInputQuery(address);
    scan(address);
  }, [address, scan]);

  // ── Claim fees ─────────────────────────────────────────────────────────────
  const claimFees = useCallback(async (position: FeePosition) => {
    if (!address) return;
    const key = `${position.platform}-${position.tokenAddress}`;

    setClaimStatus(prev => ({ ...prev, [key]: { tokenAddress: position.tokenAddress, status: "claiming" } }));

    try {
      const { data, error } = await supabase.functions.invoke("claim-fees", {
        body: {
          action:       "claim",
          platform:     position.platform,
          tokenAddress: position.tokenAddress,
          poolAddress:  position.poolAddress,
          walletAddress: address,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Claim failed");

      // data.transaction = base64 encoded transaction yang perlu di-sign
      // Di production: kirim ke wallet adapter untuk sign
      // Untuk sekarang, tampilkan success dengan txHash jika ada
      setClaimStatus(prev => ({
        ...prev,
        [key]: { tokenAddress: position.tokenAddress, status: "success", txHash: data.txHash },
      }));

      // Refresh scan setelah claim
      setTimeout(() => scan(scanQuery), 2000);
    } catch (err: any) {
      setClaimStatus(prev => ({
        ...prev,
        [key]: { tokenAddress: position.tokenAddress, status: "error", error: err.message },
      }));
    }
  }, [address, scanQuery, scan]);

  // ── Computed ───────────────────────────────────────────────────────────────
  const totalAllSol = Object.values(platforms).reduce((s, p) => s + p.totalSol, 0);
  const totalAllUsd = Object.values(platforms).reduce((s, p) => s + p.totalUsd, 0);
  const totalPositions = Object.values(platforms).reduce((s, p) => s + p.positions.length, 0);
  const anyLoading = Object.values(platforms).some(p => p.loading);

  const copyAddr = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="container mx-auto max-w-2xl px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Coins className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Unclaimed Fees</h1>
      </div>

      {/* Search bar */}
      <div className="mb-6 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Paste wallet address atau @username Twitter..."
              value={inputQuery}
              onChange={e => setInputQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && scan(inputQuery)}
              className="w-full bg-card border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <Button
            onClick={() => scan(inputQuery)}
            disabled={!inputQuery.trim() || scanning}
            className="shrink-0 gap-2"
          >
            {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Scan
          </Button>
        </div>

        {/* Quick scan dari wallet */}
        {status === "connected" && address && (
          <button
            onClick={scanFromWallet}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            <Wallet className="h-3.5 w-3.5" />
            Scan wallet saya ({truncAddr(address)})
          </button>
        )}
      </div>

      {/* Hasil scan */}
      <AnimatePresence>
        {scanned && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Summary card */}
            <motion.div
              className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-transparent border border-primary/20"
              initial={{ scale: 0.97 }} animate={{ scale: 1 }}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Total unclaimed</p>
                  <p className="text-2xl font-bold text-foreground">{formatSol(totalAllSol)}</p>
                  <p className="text-sm text-muted-foreground">{formatUsd(totalAllUsd)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground mb-0.5">Posisi ditemukan</p>
                  <p className="text-2xl font-bold text-foreground">{totalPositions}</p>
                  <p className="text-sm text-muted-foreground">di 3 platform</p>
                </div>
              </div>

              {/* Address yang discan */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background/50 border border-border">
                <span className="text-xs text-muted-foreground font-mono truncate flex-1">{scanQuery}</span>
                <button onClick={() => copyAddr(scanQuery)} className="shrink-0 text-muted-foreground hover:text-primary transition-colors">
                  {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
                <button onClick={() => scan(scanQuery)} className="shrink-0 text-muted-foreground hover:text-primary transition-colors">
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>
            </motion.div>

            {/* Platform tabs */}
            <div className="flex gap-1 p-1 bg-muted/40 rounded-xl">
              {(["bags", "pump", "bonk"] as const).map(p => {
                const meta = PLATFORM_META[p];
                const plat = platforms[p];
                return (
                  <button key={p} onClick={() => setActiveTab(p)}
                    className={`flex-1 py-2 px-2 rounded-lg text-xs font-semibold transition-all flex flex-col items-center gap-0.5 ${
                      activeTab === p ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}>
                    <span>{meta.icon} {meta.label}</span>
                    {plat.loading ? (
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    ) : plat.error ? (
                      <span className="text-[10px] text-destructive">error</span>
                    ) : (
                      <span className={`text-[10px] font-bold ${plat.totalSol > 0 ? meta.color : "text-muted-foreground"}`}>
                        {plat.totalSol > 0 ? formatSol(plat.totalSol) : plat.scanned ? "—" : "..."}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Platform content */}
            {(["bags", "pump", "bonk"] as const).map(p => {
              if (activeTab !== p) return null;
              const meta = PLATFORM_META[p];
              const plat = platforms[p];

              return (
                <motion.div key={p} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  {/* Platform header */}
                  <div className={`flex items-center justify-between p-3 rounded-xl bg-gradient-to-r ${meta.gradient} to-transparent border ${meta.border} mb-3`}>
                    <div>
                      <span className={`text-sm font-semibold ${meta.color}`}>{meta.icon} {meta.label}</span>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{meta.desc}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-base font-bold ${plat.totalSol > 0 ? meta.color : "text-muted-foreground"}`}>
                        {plat.loading ? "..." : formatSol(plat.totalSol)}
                      </p>
                      {plat.totalUsd > 0 && (
                        <p className="text-[11px] text-muted-foreground">{formatUsd(plat.totalUsd)}</p>
                      )}
                    </div>
                  </div>

                  {/* Loading */}
                  {plat.loading && (
                    <div className="space-y-2">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-border">
                          <div className="w-9 h-9 rounded-xl bg-muted animate-pulse shrink-0" />
                          <div className="flex-1 space-y-1.5">
                            <div className="h-3 bg-muted rounded animate-pulse w-1/3" />
                            <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
                          </div>
                          <div className="w-16 h-8 bg-muted rounded-lg animate-pulse" />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Error */}
                  {!plat.loading && plat.error && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/5 border border-destructive/20 text-sm text-destructive">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      {plat.error}
                    </div>
                  )}

                  {/* Empty */}
                  {!plat.loading && !plat.error && plat.positions.length === 0 && plat.scanned && (
                    <div className="text-center py-10">
                      <Coins className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">Tidak ada unclaimed fees di {meta.label}</p>
                    </div>
                  )}

                  {/* Positions list */}
                  {!plat.loading && plat.positions.length > 0 && (
                    <div className="space-y-2">
                      {plat.positions.map((pos, i) => {
                        const claimKey = `${pos.platform}-${pos.tokenAddress}`;
                        const cs       = claimStatus[claimKey];
                        const isOpen   = expanded.has(claimKey);

                        return (
                          <motion.div key={claimKey}
                            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.04 }}
                            className="rounded-xl border border-border bg-card overflow-hidden"
                          >
                            {/* Row utama */}
                            <div className="flex items-center gap-3 p-3">
                              {/* Icon token */}
                              <div className="w-9 h-9 rounded-xl overflow-hidden bg-muted border border-border flex items-center justify-center shrink-0">
                                {pos.tokenIcon
                                  ? <img src={pos.tokenIcon} alt="" className="w-full h-full object-cover" loading="lazy" />
                                  : <span className="text-[10px] font-bold text-muted-foreground">{pos.tokenSymbol.slice(0, 2).toUpperCase()}</span>
                                }
                              </div>

                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-sm font-semibold text-foreground truncate">{pos.tokenName}</span>
                                  <span className="shrink-0 text-[9px] font-bold px-1 py-0.5 rounded bg-muted text-muted-foreground">{pos.tokenSymbol}</span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className={`text-xs font-semibold ${meta.color}`}>{formatSol(pos.unclaimedSol)}</span>
                                  <span className="text-[10px] text-muted-foreground">{formatUsd(pos.unclaimedUsd)}</span>
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-2 shrink-0">
                                {cs?.status === "success" ? (
                                  <div className="flex items-center gap-1 text-success text-xs font-medium">
                                    <CheckCircle2 className="h-4 w-4" /> Claimed
                                  </div>
                                ) : cs?.status === "error" ? (
                                  <span className="text-xs text-destructive">Failed</span>
                                ) : (
                                  pos.claimable && status === "connected" && (
                                    <Button size="sm" variant="outline"
                                      className={`h-7 text-xs px-3 border ${meta.border} ${meta.color} hover:${meta.bg}`}
                                      disabled={cs?.status === "claiming"}
                                      onClick={() => claimFees(pos)}
                                    >
                                      {cs?.status === "claiming"
                                        ? <Loader2 className="h-3 w-3 animate-spin" />
                                        : "Claim"
                                      }
                                    </Button>
                                  )
                                )}
                                <button
                                  onClick={() => setExpanded(prev => {
                                    const n = new Set(prev);
                                    n.has(claimKey) ? n.delete(claimKey) : n.add(claimKey);
                                    return n;
                                  })}
                                  className="text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </button>
                              </div>
                            </div>

                            {/* Detail expand */}
                            <AnimatePresence>
                              {isOpen && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="overflow-hidden"
                                >
                                  <div className="px-3 pb-3 pt-1 border-t border-border space-y-2 text-xs">
                                    {/* Token address */}
                                    <div className="flex items-center justify-between">
                                      <span className="text-muted-foreground">Token Address</span>
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-mono text-foreground">{truncAddr(pos.tokenAddress)}</span>
                                        <button onClick={() => copyAddr(pos.tokenAddress)} className="text-muted-foreground hover:text-primary">
                                          <Copy className="h-3 w-3" />
                                        </button>
                                        <a href={meta.url(pos.tokenAddress)} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary">
                                          <ExternalLink className="h-3 w-3" />
                                        </a>
                                      </div>
                                    </div>

                                    {/* Pool address */}
                                    {pos.poolAddress && (
                                      <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Pool Address</span>
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-mono text-foreground">{truncAddr(pos.poolAddress)}</span>
                                          <button onClick={() => copyAddr(pos.poolAddress!)} className="text-muted-foreground hover:text-primary">
                                            <Copy className="h-3 w-3" />
                                          </button>
                                        </div>
                                      </div>
                                    )}

                                    {/* Position type */}
                                    {pos.positionType && (
                                      <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Jenis posisi</span>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${meta.bg} ${meta.color}`}>
                                          {pos.positionType === "virtual" ? "Bonding Curve" :
                                           pos.positionType === "damm"    ? "DAMM v2 Pool" :
                                           pos.positionType === "custom_vault" ? "Custom Vault" :
                                           pos.positionType}
                                        </span>
                                      </div>
                                    )}

                                    {/* Unclaimed breakdown */}
                                    <div className="flex items-center justify-between">
                                      <span className="text-muted-foreground">Unclaimed fees</span>
                                      <span className={`font-semibold ${meta.color}`}>{formatSol(pos.unclaimedSol)} ({formatUsd(pos.unclaimedUsd)})</span>
                                    </div>

                                    {/* Claim error detail */}
                                    {cs?.status === "error" && cs.error && (
                                      <div className="flex items-start gap-1.5 p-2 rounded-lg bg-destructive/10 text-destructive">
                                        <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                        <span>{cs.error}</span>
                                      </div>
                                    )}

                                    {/* Claim success txHash */}
                                    {cs?.status === "success" && cs.txHash && (
                                      <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Tx Hash</span>
                                        <a href={`https://solscan.io/tx/${cs.txHash}`} target="_blank" rel="noopener noreferrer"
                                          className="flex items-center gap-1 text-success hover:underline font-mono">
                                          {truncAddr(cs.txHash, 8, 4)}
                                          <ExternalLink className="h-3 w-3" />
                                        </a>
                                      </div>
                                    )}

                                    {/* Wallet not connected warning */}
                                    {status !== "connected" && pos.claimable && (
                                      <div className="flex items-center gap-1.5 p-2 rounded-lg bg-warning/10 text-warning text-[11px]">
                                        <Wallet className="h-3.5 w-3.5 shrink-0" />
                                        Connect wallet untuk claim fees ini
                                      </div>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state awal */}
      {!scanned && !scanning && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-16"
        >
          <div className="relative mx-auto mb-6 w-20 h-20">
            <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" style={{ animationDuration: "3s" }} />
            <div className="relative w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Coins className="h-9 w-9 text-primary" />
            </div>
          </div>
          <h2 className="text-lg font-semibold mb-2">Cek Unclaimed Fees</h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">
            Masukkan wallet address atau @username Twitter untuk melihat semua fees yang belum di-claim dari Bags.fm, Pump.fun, dan Bonk.fun.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span>🛍️</span> Bags.fm</span>
            <span className="text-border">·</span>
            <span className="flex items-center gap-1"><span>⚡</span> Pump.fun</span>
            <span className="text-border">·</span>
            <span className="flex items-center gap-1"><span>🦊</span> Bonk.fun</span>
          </div>
          {status === "connected" && address && (
            <Button onClick={scanFromWallet} className="mt-6 gap-2" variant="outline">
              <Wallet className="h-4 w-4" /> Scan Wallet Saya
            </Button>
          )}
        </motion.div>
      )}

      {/* Scanning state */}
      {scanning && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-16"
        >
          <div className="relative mx-auto mb-6 w-20 h-20">
            <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-spin" style={{ animationDuration: "3s" }} />
            <div className="absolute inset-2 rounded-full border-2 border-primary/50 animate-spin" style={{ animationDuration: "2s", animationDirection: "reverse" }} />
            <div className="absolute inset-4 rounded-full bg-primary/10 flex items-center justify-center">
              <Search className="h-5 w-5 text-primary" />
            </div>
          </div>
          <p className="text-sm font-medium mb-1">Scanning semua platform...</p>
          <p className="text-xs text-muted-foreground">Bags.fm · Pump.fun · Bonk.fun</p>
          <div className="flex items-center justify-center gap-3 mt-4">
            {(["bags", "pump", "bonk"] as const).map(p => (
              <div key={p} className="flex items-center gap-1.5 text-xs">
                {platforms[p].scanned
                  ? <CheckCircle2 className={`h-3.5 w-3.5 ${PLATFORM_META[p].color}`} />
                  : <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                }
                <span className={platforms[p].scanned ? PLATFORM_META[p].color : "text-muted-foreground"}>
                  {PLATFORM_META[p].label}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}