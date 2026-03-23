import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Shield, AlertTriangle, CheckCircle2, XCircle,
  TrendingUp, TrendingDown, Users, Lock, Unlock, Globe,
  Twitter, MessageCircle, Copy, Check, ExternalLink,
  Network, GitBranch, ArrowRight, X as XIcon, Clock,
  Zap, Activity, BarChart3, RefreshCw, Loader2,
  AlertCircle, Info, ChevronRight, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RiskItem {
  name: string;
  score: number;        // 0 = good, higher = risky
  level: "good" | "warn" | "danger";
  description: string;
}

type HolderType = "lp" | "bondingCurve" | "insider" | "dev" | "system" | "normal";

interface Holder {
  address: string;
  pct: number;
  label: string | null;
  type: HolderType;
  isInsider: boolean;
  isLP: boolean;
}

interface MarketData {
  priceUsd: string | null;
  priceChange24h: number | null;
  marketCap: number | null;
  liquidity: number | null;
  volume24h: number | null;
  txns24h: { buys: number; sells: number } | null;
  pairCreatedAt: number | null;
  dexId: string | null;
  pairAddress: string | null;
  dexUrl: string | null;
}

interface SecurityData {
  mintAuthority: string | null;
  freezeAuthority: string | null;
  lpLocked: boolean;
  lpLockedPct: number;
  top10HolderPct: number;
  insiderPct: number;
  totalHolders: number;
  risks: RiskItem[];
  rugScore: number;         // 0-100, higher = safer
  verdict: "SAFE" | "CAUTION" | "DANGER" | "LIKELY_RUG";
  topHolders: Holder[];
}

interface TokenMeta {
  mint: string;
  name: string;
  symbol: string;
  icon: string | null;
  description: string | null;
  twitter: string | null;
  telegram: string | null;
  website: string | null;
  creator: string | null;
}

// ─── Cluster / Bundle Detection Types ────────────────────────────────────────

interface ClusterTransfer {
  from:      string;
  to:        string;
  amount:    number;     // token amount
  amountPct: number;     // % of supply
  txHash:    string;
  timestamp: number;
  slot:      number;
}

interface WalletCluster {
  id:         string;    // funder address (root)
  funder:     string;    // address that distributed tokens
  members:    string[];  // addresses that received from funder
  totalPct:   number;    // total % supply dipegang oleh cluster
  transfers:  ClusterTransfer[];
  riskLevel:  "high" | "medium" | "low";
  label:      string;    // e.g. "Coordinated Bundle", "Whale Distribution"
}

interface ClusterResult {
  clusters:     WalletCluster[];
  scanned:      number;  // number of holders scanned
  scanTimestamp: number;
  hasRisk:      boolean;
}

interface AnalyticsResult {
  meta: TokenMeta;
  market: MarketData;
  security: SecurityData;
  scanTimestamp: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, digits = 2): string {
  if (n == null) return "—";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(digits)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(digits)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(digits)}`;
}

function fmtPrice(p: string | null): string {
  if (!p) return "—";
  const n = parseFloat(p);
  if (isNaN(n)) return "—";
  if (n >= 1) return `$${n.toFixed(4)}`;
  const s = n.toFixed(12);
  const m = s.match(/^0\.(0*)([1-9]\d{0,3})/);
  if (m) return `$${n.toFixed(m[1].length + m[2].length + 1)}`;
  return `$${n.toExponential(2)}`;
}

function truncAddr(a: string, h = 4, t = 4) {
  return `${a.slice(0, h)}...${a.slice(-t)}`;
}

function timeAgo(ts: number): string {
  const d = Date.now() - ts;
  const m = Math.floor(d / 60000);
  if (m < 60) return `${m}m`;
  const hr = Math.floor(m / 60);
  if (hr < 24) return `${hr}h`;
  return `${Math.floor(hr / 24)}d`;
}

// ─── Fetch functions ───────────────────────────────────────────────────────────

async function fetchRugCheck(mint: string) {
  const res = await fetch(`https://api.rugcheck.xyz/v1/tokens/${mint}/report`, {
    signal: AbortSignal.timeout(12000),
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`RugCheck ${res.status}`);
  return res.json();
}

// Fetch largest token accounts via Helius RPC
// Most reliable source for LP detection:
// LP pool = token account with large balance owned by AMM program
async function fetchDexScreener(mint: string) {
  // Try both DexScreener endpoints for maximum coverage
  // /tokens/v1 = new API, /latest/dex/tokens = legacy (more reliable for pair data)
  const [res1, res2] = await Promise.allSettled([
    fetch(`https://api.dexscreener.com/tokens/v1/solana/${mint}`,
      { signal: AbortSignal.timeout(10000) }).then(r => r.ok ? r.json() : null),
    fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`,
      { signal: AbortSignal.timeout(10000) }).then(r => r.ok ? r.json() : null),
  ]);

  const data1 = res1.status === "fulfilled" ? res1.value : null;
  const data2 = res2.status === "fulfilled" ? res2.value : null;

  // Gabungkan pairs dari kedua response
  const pairs1: any[] = Array.isArray(data1) ? data1 : (data1?.pairs ?? []);
  const pairs2: any[] = Array.isArray(data2) ? data2 : (data2?.pairs ?? []);

  const allPairs = [...pairs1, ...pairs2];
  if (allPairs.length === 0) throw new Error("No pairs found on DexScreener");
  return { pairs: allPairs };
}

// ─── Parse raw data ───────────────────────────────────────────────────────────

// ─── Cluster/Bundle Detection ────────────────────────────────────────────────
// All RPC calls run server-side (Supabase edge function)
// because public Solana RPC blocks CORS from browser

async function fetchClusterData(
  mint: string,
  topHolders: Holder[],
): Promise<ClusterResult> {
  const realHolders = topHolders
    .filter(h => !h.isLP && h.type !== "system" && h.type !== "bondingCurve")
    .slice(0, 12)
    .map(h => ({ address: h.address, pct: h.pct }));

  if (realHolders.length < 2) {
    return { clusters: [], scanned: realHolders.length, scanTimestamp: Date.now(), hasRisk: false };
  }

  // Use MARKET supabase project (rzmxadusddrqxlkiazsk) — same as fetch-tokens
  // NOT the main project (ypecnywqbzxblfhthhsi) used by supabase client
  const MARKET_URL = import.meta.env.VITE_MARKET_SUPABASE_URL as string;
  const MARKET_KEY = import.meta.env.VITE_MARKET_SUPABASE_ANON_KEY as string;

  const res = await fetch(`${MARKET_URL}/functions/v1/token-clusters`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": MARKET_KEY,
      "Authorization": `Bearer ${MARKET_KEY}`,
    },
    body: JSON.stringify({ mint, holders: realHolders }),
    signal: AbortSignal.timeout(90000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`Cluster scan failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  if (!data?.success) throw new Error(data?.error ?? "Cluster scan failed");

  return {
    clusters:      data.clusters      ?? [],
    scanned:       data.scanned       ?? realHolders.length,
    scanTimestamp: data.scanTimestamp ?? Date.now(),
    hasRisk:       data.hasRisk       ?? false,
  };
}


// ── Fetch creator token balance ─────────────────────────────────────────────
async function fetchCreatorBalance(creatorAddr: string, mint: string): Promise<number | null> {
  try {
    const HELIUS_KEY = (import.meta as any).env?.VITE_HELIUS_API_KEY ?? "";
    const rpcUrl = HELIUS_KEY
      ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`
      : "https://api.mainnet-beta.solana.com";
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "getTokenAccountsByOwner",
        params: [creatorAddr, { mint }, { encoding: "jsonParsed", commitment: "confirmed" }],
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const accounts: any[] = data?.result?.value ?? [];
    return accounts.reduce((s: number, a: any) =>
      s + Number(a?.account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0), 0);
  } catch { return null; }
}

function parseResult(mint: string, rugRaw: any, dexRaw: any): AnalyticsResult {

  // ── DexScreener pairs ─────────────────────────────────────────────────────
  const rawPairs: any[] = Array.isArray(dexRaw) ? dexRaw : (dexRaw?.pairs ?? []);
  const seen = new Set<string>();
  const pairs = rawPairs.filter((p: any) => {
    if (!p?.pairAddress || seen.has(p.pairAddress)) return false;
    seen.add(p.pairAddress); return true;
  });
  const bestPair = [...pairs].sort((a: any, b: any) => {
    const boost = (d: any) => (d.dexId ?? "").toLowerCase().includes("pump") ? 1.2 : 1;
    return (b.liquidity?.usd ?? 0) * boost(b) - (a.liquidity?.usd ?? 0) * boost(a);
  })[0] ?? null;

  const totalLiquidity = pairs.reduce((s: number, p: any) => s + (p.liquidity?.usd ?? 0), 0);
  const totalVolume    = pairs.reduce((s: number, p: any) => s + (p.volume?.h24  ?? 0), 0);
  const totalBuys      = pairs.reduce((s: number, p: any) => s + (p.txns?.h24?.buys  ?? 0), 0);
  const totalSells     = pairs.reduce((s: number, p: any) => s + (p.txns?.h24?.sells ?? 0), 0);

  // ── Key insight dari data aktual RugCheck ─────────────────────────────────
  //
  // topHolders[i] = {
  //   address: "Gr1c..."  ← token account address (liquidityA/B dari market)
  //   owner:   "HPYfj..."  ← who OWNS this token account
  //   pct:     7.17
  // }
  //
  // knownAccounts = {
  //   "HPYfj...": { name: "Pump Fun AMM", type: "AMM" }  ← owner ada di sini!
  //   "4D8Kh...": { name: "Pump Fun AMM", type: "AMM" }
  // }
  //
  // So LP detection = topHolders[i].owner → lookup knownAccounts → type === "AMM"

  const knownAccounts: Record<string, { name: string; type: string }> =
    rugRaw?.knownAccounts ?? {};

  // Also collect all pool pubkeys from markets as LP identifiers
  const lpPubkeys = new Set<string>();
  for (const m of (rugRaw?.markets ?? [])) {
    if (m.pubkey)       lpPubkeys.add(m.pubkey);
    if (m.liquidityA)   lpPubkeys.add(m.liquidityA);
    if (m.liquidityB)   lpPubkeys.add(m.liquidityB);
  }

  // ── Process topHolders ────────────────────────────────────────────────────
  const topHolders: Holder[] = (rugRaw?.topHolders ?? []).slice(0, 20).map((h: any) => {
    const addr      = h.address ?? "";
    const ownerAddr = h.owner   ?? "";  // ← KEY FIELD from RugCheck

    // Lookup owner di knownAccounts
    const ownerInfo = knownAccounts[ownerAddr];
    const ownerType = (ownerInfo?.type ?? "").toUpperCase();
    const ownerName = ownerInfo?.name ?? "";

    // Cek apakah address itu sendiri ada di knownAccounts (pool pubkey)
    const selfInfo  = knownAccounts[addr];
    const selfType  = (selfInfo?.type ?? "").toUpperCase();

    // Tentukan tipe holder
    let type: HolderType = "normal";
    let label: string | null = h.account?.label ?? null;

    if (ownerType === "AMM" || selfType === "AMM" || lpPubkeys.has(addr)) {
      // LP Pool — tentukan nama spesifik dari knownAccounts
      const poolName = ownerName || selfInfo?.name || "";
      if (poolName.toLowerCase().includes("pump fun amm") ||
          poolName.toLowerCase().includes("pumpswap"))
        type = "lp";
      else if (poolName.toLowerCase().includes("meteora"))
        type = "lp";
      else if (poolName.toLowerCase().includes("raydium"))
        type = "lp";
      else if (poolName.toLowerCase().includes("orca"))
        type = "lp";
      else
        type = "lp";

      // Label = nama pool dari knownAccounts
      if (!label) label = poolName || "LP Pool";

    } else if (ownerType === "CREATOR" || selfType === "CREATOR") {
      type  = "normal"; // creator = normal holder for display
      label = label ?? ownerInfo?.name ?? selfInfo?.name ?? "Creator";

    } else if (h.insider === true) {
      type = "insider";
    }

    return {
      address:   addr,
      pct:       parseFloat(h.pct ?? h.uiAmount ?? "0"),
      label,
      type,
      isLP:      type === "lp" || type === "bondingCurve",
      isInsider: h.insider === true && type !== "lp",
    };
  });

  // ── Security stats ─────────────────────────────────────────────────────────
  const mintAuth   = rugRaw?.mintAuthority   ?? null;
  const freezeAuth = rugRaw?.freezeAuthority ?? null;

  const lpLockedPct  = rugRaw?.markets?.[0]?.lp?.lpLockedPct ?? 0;
  const lpLocked     = lpLockedPct > 0;

  // top10 only from REAL holders (excluding LP/system)
  const realHolders  = topHolders.filter(h => !h.isLP && h.type !== "system");
  const top10Pct     = realHolders.slice(0, 10).reduce((s, h) => s + h.pct, 0);
  const insiderPct   = topHolders.filter(h => h.isInsider).reduce((s, h) => s + h.pct, 0);
  const totalHolders = rugRaw?.totalHolders ?? 0;

  // Risks dari RugCheck
  const risks: RiskItem[] = (rugRaw?.risks ?? []).map((r: any) => ({
    name:        r.name ?? r.type ?? "Risk",
    score:       r.score ?? 0,
    level:       r.level === "danger" ? "danger" : r.level === "warn" ? "warn" : "good",
    description: r.description ?? "",
  }));

  // Compute rug score
  let score = 100;
  if (mintAuth)              score -= 25;
  if (freezeAuth)            score -= 15;
  if (!lpLocked)             score -= 20;
  if (top10Pct > 50)         score -= 20;
  if (top10Pct > 80)         score -= 10;
  if (insiderPct > 10)       score -= 15;
  const dangers = risks.filter(r => r.level === "danger").length;
  const warns   = risks.filter(r => r.level === "warn").length;
  score -= dangers * 10;
  score -= warns   *  5;
  score = Math.max(0, Math.min(100, score));

  const verdict: SecurityData["verdict"] =
    score >= 75 ? "SAFE" : score >= 50 ? "CAUTION" : score >= 25 ? "DANGER" : "LIKELY_RUG";

  // ── Meta ──────────────────────────────────────────────────────────────────
  const socials = bestPair?.info?.socials ?? [];
  const meta: TokenMeta = {
    mint,
    name:           rugRaw?.tokenMeta?.name   ?? bestPair?.baseToken?.name   ?? "Unknown",
    symbol:         rugRaw?.tokenMeta?.symbol ?? bestPair?.baseToken?.symbol ?? "???",
    icon:           rugRaw?.tokenMeta?.image  ?? bestPair?.info?.imageUrl    ?? null,
    description:    rugRaw?.tokenMeta?.description ?? null,
    twitter:        rugRaw?.tokenMeta?.twitter  ?? socials.find((s: any) => s.type === "twitter")?.url  ?? null,
    telegram:       rugRaw?.tokenMeta?.telegram ?? socials.find((s: any) => s.type === "telegram")?.url ?? null,
    website:        rugRaw?.tokenMeta?.website  ?? bestPair?.info?.websites?.[0]?.url ?? null,
    creator:        rugRaw?.creator ?? null,
    creatorBalance: null, // diisi oleh fetchCreatorBalance
  };

  // ── Market ────────────────────────────────────────────────────────────────
  const market: MarketData = {
    priceUsd:       bestPair?.priceUsd ?? null,
    priceChange24h: bestPair?.priceChange?.h24 ?? null,
    marketCap:      bestPair?.marketCap ?? bestPair?.fdv ?? null,
    liquidity:      totalLiquidity || bestPair?.liquidity?.usd || null,
    volume24h:      totalVolume    || bestPair?.volume?.h24    || null,
    txns24h:        (totalBuys + totalSells) > 0
      ? { buys: totalBuys, sells: totalSells }
      : (bestPair?.txns?.h24 ? { buys: bestPair.txns.h24.buys, sells: bestPair.txns.h24.sells } : null),
    pairCreatedAt:  bestPair?.pairCreatedAt ?? null,
    dexId:          bestPair?.dexId  ?? null,
    pairAddress:    bestPair?.pairAddress ?? null,
    dexUrl:         bestPair?.url    ?? null,
  };

  return {
    meta,
    market,
    security: {
      mintAuthority: mintAuth, freezeAuthority: freezeAuth,
      lpLocked, lpLockedPct, top10HolderPct: top10Pct,
      insiderPct, totalHolders, risks, rugScore: score, verdict, topHolders,
    },
    scanTimestamp: Date.now(),
  };
}


// ─── Sub-components ───────────────────────────────────────────────────────────

function VerdictBadge({ verdict, score }: { verdict: SecurityData["verdict"]; score: number }) {
  const cfg = {
    SAFE:       { color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/30", label: "SAFE",       icon: CheckCircle2 },
    CAUTION:    { color: "text-yellow-400",  bg: "bg-yellow-400/10  border-yellow-400/30",  label: "CAUTION",    icon: AlertTriangle },
    DANGER:     { color: "text-orange-400",  bg: "bg-orange-400/10  border-orange-400/30",  label: "DANGER",     icon: AlertTriangle },
    LIKELY_RUG: { color: "text-red-400",     bg: "bg-red-400/10     border-red-400/30",     label: "LIKELY RUG", icon: XCircle },
  }[verdict];
  const Icon = cfg.icon;
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${cfg.bg}`}>
      <Icon className={`h-4 w-4 ${cfg.color}`} />
      <span className={`text-sm font-bold font-mono tracking-wider ${cfg.color}`}>{cfg.label}</span>
      <span className={`text-xs font-mono ${cfg.color} opacity-70`}>{score}/100</span>
    </div>
  );
}

// Animated score ring
function ScoreRing({ score }: { score: number }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const color = score >= 75 ? "#34d399" : score >= 50 ? "#fbbf24" : score >= 25 ? "#f97316" : "#f87171";
  const offset = circ - (score / 100) * circ;
  return (
    <div className="relative flex items-center justify-center w-36 h-36">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
        <motion.circle
          cx="60" cy="60" r={r}
          fill="none" stroke={color} strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: "easeOut", delay: 0.3 }}
        />
      </svg>
      <div className="relative text-center">
        <motion.div
          className="text-3xl font-bold font-mono"
          style={{ color }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
        >
          {score}
        </motion.div>
        <div className="text-[10px] text-muted-foreground tracking-widest uppercase">Safety</div>
      </div>
    </div>
  );
}

// Security check row
function SecurityRow({ label, ok, value, warn }: { label: string; ok: boolean; value?: string; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
      <div className="flex items-center gap-2">
        {ok
          ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
          : warn
          ? <AlertTriangle className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
          : <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
        }
        <span className="text-xs text-muted-foreground font-mono">{label}</span>
      </div>
      {value && (
        <span className={`text-xs font-mono font-medium ${ok ? "text-emerald-400" : warn ? "text-yellow-400" : "text-red-400"}`}>
          {value}
        </span>
      )}
    </div>
  );
}

// Holder type config
const HOLDER_TYPE_CFG = {
  lp:           { color: "bg-blue-400",    text: "text-blue-400",    badge: "bg-blue-400/15 text-blue-400",    label: "LP" },
  bondingCurve: { color: "bg-purple-400",  text: "text-purple-400",  badge: "bg-purple-400/15 text-purple-400", label: "BONDING CURVE" },
  insider:      { color: "bg-red-400",     text: "text-red-400",     badge: "bg-red-400/15 text-red-400",      label: "INSIDER" },
  dev:          { color: "bg-orange-400",  text: "text-orange-400",  badge: "bg-orange-400/15 text-orange-400", label: "DEV" },
  system:       { color: "bg-slate-400",   text: "text-slate-400",   badge: "bg-slate-400/15 text-slate-400",  label: "SYSTEM" },
  normal:       { color: "bg-primary",     text: "text-muted-foreground", badge: "", label: "" },
};

function HolderBar({ holder, i }: { holder: Holder; i: number }) {
  const cfg     = HOLDER_TYPE_CFG[holder.type] ?? HOLDER_TYPE_CFG.normal;
  const isSpecial = holder.type !== "normal";

  // LP/BondingCurve not counted as "rug risk" — lower opacity
  const opacity = holder.isLP ? "opacity-50" : "opacity-100";

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
      transition={{ delay: i * 0.04 }}
      className={`flex items-center gap-3 py-2 px-2 rounded-lg transition-colors ${
        holder.type === "lp"           ? "opacity-50 bg-blue-400/[0.03]" :
        holder.type === "bondingCurve" ? "opacity-50 bg-purple-400/[0.03]" :
        holder.type === "system"       ? "opacity-40" :
        holder.type === "insider"      ? "bg-red-400/[0.04]" :
        "hover:bg-white/[0.02]"
      }`}
    >
      <span className="text-[10px] text-muted-foreground font-mono w-5 text-right shrink-0">
        {holder.isLP || holder.type === "system" ? "—" : i + 1}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          {/* Label or address */}
          <span className={`text-xs font-mono truncate ${isSpecial ? cfg.text : "text-foreground/70"}`}>
            {holder.label
              ? holder.label
              : holder.type === "lp"
              ? `LP Pool · ${truncAddr(holder.address, 4, 4)}`
              : holder.type === "bondingCurve"
              ? `Bonding Curve · ${truncAddr(holder.address, 4, 4)}`
              : holder.type === "system"
              ? `Program · ${truncAddr(holder.address, 4, 4)}`
              : truncAddr(holder.address)
            }
          </span>
          {/* Type badge */}
          {isSpecial && cfg.label && (
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${cfg.badge}`}>
              {cfg.label}
            </span>
          )}
          {/* Whale badge for normal large holders */}
          {holder.type === "normal" && holder.pct > 10 && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 bg-orange-400/15 text-orange-400">
              WHALE
            </span>
          )}
        </div>
        <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${cfg.color}`}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(holder.pct * 2.5, 100)}%` }}
            transition={{ delay: 0.2 + i * 0.04, duration: 0.6, ease: "easeOut" }}
          />
        </div>
      </div>
      <span className={`text-xs font-mono font-bold shrink-0 w-12 text-right ${
        holder.isLP ? "text-muted-foreground/40" : cfg.text
      }`}>
        {holder.pct.toFixed(1)}%
      </span>
    </motion.div>
  );
}

// Stat card
function StatCard({ label, value, sub, trend, icon: Icon }: {
  label: string; value: string; sub?: string;
  trend?: "up" | "down" | null; icon?: any
}) {
  return (
    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-primary/20 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono">{label}</span>
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground/50" />}
        {trend && (
          trend === "up"
            ? <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
            : <TrendingDown className="h-3.5 w-3.5 text-red-400" />
        )}
      </div>
      <div className="text-base font-bold font-mono text-foreground">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">{sub}</div>}
    </div>
  );
}

// Risk item
function RiskTag({ risk }: { risk: RiskItem }) {
  const cfg = {
    good:   { bg: "bg-emerald-400/8 border-emerald-400/20", text: "text-emerald-400", dot: "bg-emerald-400" },
    warn:   { bg: "bg-yellow-400/8  border-yellow-400/20",  text: "text-yellow-400",  dot: "bg-yellow-400" },
    danger: { bg: "bg-red-400/8     border-red-400/20",     text: "text-red-400",     dot: "bg-red-400" },
  }[risk.level];

  return (
    <div className={`flex items-start gap-2.5 p-2.5 rounded-lg border ${cfg.bg}`}>
      <div className={`h-1.5 w-1.5 rounded-full ${cfg.dot} mt-1.5 shrink-0`} />
      <div className="min-w-0">
        <div className={`text-xs font-semibold font-mono ${cfg.text}`}>{risk.name}</div>
        {risk.description && (
          <div className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{risk.description}</div>
        )}
      </div>
    </div>
  );
}

// Scanning animation lines
function ScanLines() {
  return (
    <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"
          style={{ top: `${10 + i * 12}%` }}
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: [0, 0.6, 0], scaleX: [0, 1, 1] }}
          transition={{
            duration: 1.5,
            delay: i * 0.12,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type ScanPhase = "idle" | "scanning" | "done" | "error";
type ActiveTab = "overview" | "security" | "holders" | "clusters" | "risks";

export default function TokenAnalyticsPage() {
  const [query, setQuery]     = useState("");
  const [phase, setPhase]     = useState<ScanPhase>("idle");
  const [error, setError]     = useState<string | null>(null);
  const [result, setResult]   = useState<AnalyticsResult | null>(null);
  const [tab, setTab]           = useState<ActiveTab>("overview");
  const [copied, setCopied]     = useState(false);
  const [scanLog, setScanLog]   = useState<string[]>([]);
  const [clusters, setClusters]   = useState<ClusterResult | null>(null);
  const [clusterLoading, setClusterLoading] = useState(false);
  const [clusterError, setClusterError]     = useState<string | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<WalletCluster | null>(null);
  const inputRef              = useRef<HTMLInputElement>(null);
  const logRef                = useRef<HTMLDivElement>(null);

  const addLog = useCallback((msg: string) => {
    setScanLog(prev => [...prev.slice(-6), msg]);
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [scanLog]);

  // Trigger cluster scan saat tab "clusters" dibuka (lazy load)
  useEffect(() => {
    if (tab !== "clusters") return;
    if (!result)             return;
    if (clusters !== null)   return;  // already have data
    if (clusterLoading)      return;  // already loading

    setClusterLoading(true);
    setClusterError(null);

    fetchClusterData(result.meta.mint, result.security.topHolders)
      .then(r  => { setClusters(r); })
      .catch(e => {
        console.error("[ClusterDetection]", e);
        setClusterError(e?.message ?? "Scan failed");
        setClusters({ clusters: [], scanned: 0, scanTimestamp: Date.now(), hasRisk: false });
      })
      .finally(() => setClusterLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, result]);

  const scan = useCallback(async (mintInput: string) => {
    const mint = mintInput.trim();
    if (!mint || mint.length < 32) {
      setError("Invalid mint address — must be a valid Solana public key");
      return;
    }

    setPhase("scanning");
    setError(null);
    setResult(null);
    setScanLog([]);
    setClusters(null);
    setClusterError(null);
    setSelectedCluster(null);
    setTab("overview");

    try {
      addLog(`[INIT] Starting token intelligence scan...`);
      addLog(`[ADDR] ${mint.slice(0, 8)}...${mint.slice(-8)}`);

      // Stagger log messages across the 3-second window for better UX
      setTimeout(() => addLog(`[01/04] Fetching security report from RugCheck...`), 400);
      setTimeout(() => addLog(`[02/04] Fetching market data from DexScreener...`), 900);
      setTimeout(() => addLog(`[03/04] Analyzing LP pool addresses...`), 1600);
      setTimeout(() => addLog(`[04/04] Computing risk score & verdict...`), 2400);

      // Minimum 3-second scan (parallel with actual fetch)
      const [rugRaw, dexRaw] = await Promise.all([
        fetchRugCheck(mint).catch(() => ({})),
        fetchDexScreener(mint).catch(() => ([])),
        new Promise(resolve => setTimeout(resolve, 3000)),
      ]);

      addLog(`[PARSE] Processing holders & LP detection...`);

      const parsed = parseResult(mint, rugRaw, dexRaw);

      // Fetch creator balance if creator address exists
      if (parsed.meta.creator) {
        try {
          const bal = await fetchCreatorBalance(parsed.meta.creator, mint);
          parsed.meta.creatorBalance = bal;
        } catch { /* skip */ }
      }

      const lpCount = parsed.security.topHolders.filter(h => h.isLP).length;
      addLog(`[DONE] Verdict: ${parsed.security.verdict} · ${lpCount} LP detected · Score ${parsed.security.rugScore}/100`);

      setResult(parsed);
      setPhase("done");
    } catch (err: any) {
      addLog(`[ERR] ${err.message}`);
      setError(err.message || "Scan failed");
      setPhase("error");
    }
  }, [addLog]);

  const handleSearch = () => {
    if (!query.trim()) return;
    scan(query.trim());
  };

  const copyMint = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.meta.mint);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const TABS: { key: ActiveTab; label: string; icon: any }[] = [
    { key: "overview",  label: "Overview",  icon: Activity },
    { key: "security",  label: "Security",  icon: Shield },
    { key: "holders",   label: "Holders",   icon: Users },
    { key: "clusters",  label: "Clusters",  icon: Network },
    { key: "risks",     label: "Risk Feed", icon: AlertTriangle },
  ];

  // ── Cluster Flow Modal ────────────────────────────────────────────────────
  const ClusterFlowModal = selectedCluster ? (
    <AnimatePresence>
      <motion.div
        key="cluster-modal"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4"
        onClick={() => setSelectedCluster(null)}
      >
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.97 }}
          onClick={e => e.stopPropagation()}
          className="relative w-full sm:max-w-lg max-h-[85vh] overflow-hidden rounded-t-2xl sm:rounded-2xl bg-card border border-border flex flex-col"
        >
          {/* Modal header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <GitBranch className={`h-4 w-4 ${
                  selectedCluster.riskLevel === "high" ? "text-red-400" :
                  selectedCluster.riskLevel === "medium" ? "text-yellow-400" : "text-blue-400"
                }`} />
                <span className="text-sm font-bold text-foreground">{selectedCluster.label}</span>
              </div>
              <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                {selectedCluster.members.length} wallets · {selectedCluster.totalPct.toFixed(2)}% of supply
              </p>
            </div>
            <button onClick={() => setSelectedCluster(null)}
              className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <XIcon className="h-4 w-4" />
            </button>
          </div>

          {/* Modal body */}
          <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
            {/* Funder box */}
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.08]">
              <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mb-2">Source / Funder</p>
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-primary">F</span>
                </div>
                <div className="flex-1 min-w-0">
                  <code className="text-xs font-mono text-foreground/80 break-all">{selectedCluster.funder}</code>
                </div>
                <a href={`https://solscan.io/account/${selectedCluster.funder}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-muted-foreground/40 hover:text-primary transition-colors shrink-0">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>

            {/* Transaction flow */}
            <div>
              <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mb-2">Transfer Flow</p>
              <div className="space-y-2">
                {selectedCluster.transfers.map((tx, i) => (
                  <motion.div key={tx.txHash}
                    initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="relative"
                  >
                    {/* Connector line */}
                    {i < selectedCluster.transfers.length - 1 && (
                      <div className="absolute left-4 top-full w-px h-2 bg-border z-10" />
                    )}

                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-primary/15 transition-colors">
                      {/* Flow row */}
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <code className="text-[10px] font-mono text-muted-foreground/60 truncate">
                            {truncAddr(tx.from, 4, 3)}
                          </code>
                          <ArrowRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                          <code className="text-[10px] font-mono text-foreground/70 truncate">
                            {truncAddr(tx.to, 4, 3)}
                          </code>
                        </div>
                        <span className="text-xs font-bold font-mono text-primary shrink-0">
                          {tx.amountPct.toFixed(2)}%
                        </span>
                      </div>

                      {/* Tx details */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-[10px] font-mono text-muted-foreground/50 flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" />
                            {tx.timestamp > 0
                              ? new Date(tx.timestamp).toLocaleString(undefined, {
                                  month: "short", day: "numeric",
                                  hour: "2-digit", minute: "2-digit"
                                })
                              : "Unknown time"
                            }
                          </span>
                          <span className="text-[10px] font-mono text-muted-foreground/50">
                            {tx.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })} tokens
                          </span>
                        </div>
                        <a href={`https://solscan.io/tx/${tx.txHash}`}
                          target="_blank" rel="noopener noreferrer"
                          className="text-[10px] font-mono text-muted-foreground/40 hover:text-primary transition-colors flex items-center gap-0.5 shrink-0">
                          {truncAddr(tx.txHash, 4, 3)}
                          <ExternalLink className="h-2.5 w-2.5 ml-0.5" />
                        </a>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* All member wallets */}
            <div>
              <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mb-2">
                All Cluster Wallets ({selectedCluster.members.length})
              </p>
              <div className="grid grid-cols-1 gap-1.5">
                {selectedCluster.members.map((addr, i) => {
                  const holder = result?.security.topHolders.find(h => h.address === addr);
                  return (
                    <div key={addr} className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground font-mono w-4">{i+1}</span>
                        <code className="text-[10px] font-mono text-foreground/60">{truncAddr(addr, 6, 4)}</code>
                        <a href={`https://solscan.io/account/${addr}`} target="_blank" rel="noopener noreferrer"
                          className="text-muted-foreground/30 hover:text-primary transition-colors">
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      </div>
                      {holder && (
                        <span className="text-xs font-mono font-bold text-primary">{holder.pct.toFixed(2)}%</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  ) : null;

  return (
    <div className="container mx-auto max-w-2xl px-4 py-6 pb-24 md:pb-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
          <Eye className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground tracking-tight">Token Intel</h1>
          <p className="text-[11px] text-muted-foreground font-mono">AI-powered security & analytics scanner</p>
        </div>
        {result && (
          <div className="ml-auto flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">
              Scanned {timeAgo(result.scanTimestamp)} ago
            </span>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Paste token address (mint)..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              className="w-full bg-card border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors font-mono"
            />
          </div>
          <Button
            onClick={handleSearch}
            disabled={!query.trim() || phase === "scanning"}
            className="shrink-0 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
          >
            {phase === "scanning"
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Zap className="h-4 w-4" />
            }
            Scan
          </Button>
        </div>
      </div>

      {/* Scanning phase */}
      <AnimatePresence>
        {phase === "scanning" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="relative mb-6 p-4 rounded-2xl bg-card border border-primary/20 overflow-hidden"
          >
            <ScanLines />
            <div className="flex items-center gap-2 mb-3">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs font-mono text-primary font-semibold tracking-wider">SCANNING...</span>
            </div>
            <div
              ref={logRef}
              className="space-y-1 font-mono text-[11px] max-h-28 overflow-hidden"
            >
              {scanLog.map((line, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }}
                  className={`${i === scanLog.length - 1 ? "text-primary" : "text-muted-foreground/50"}`}
                >
                  {line}
                </motion.div>
              ))}
              <div className="flex items-center gap-1 text-primary">
                <span className="animate-pulse">▋</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      {phase === "error" && error && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="mb-6 flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </motion.div>
      )}

      {/* Idle state */}
      {phase === "idle" && !result && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="text-center py-16"
        >
          <div className="relative mx-auto w-20 h-20 mb-6">
            <div className="absolute inset-0 rounded-full bg-primary/5 border border-primary/10" />
            <div className="absolute inset-2 rounded-full bg-primary/8 border border-primary/15" />
            <div className="absolute inset-4 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Shield className="h-5 w-5 text-primary/60" />
            </div>
          </div>
          <h2 className="text-base font-semibold text-foreground mb-1">Token Intelligence Scanner</h2>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-6 leading-relaxed">
            Paste any Solana token address to get a full security audit, holder analysis, and risk assessment.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-muted-foreground font-mono">
            {["Security Score", "Rug Check", "Holder Analysis", "Risk Feed"].map(f => (
              <span key={f} className="px-2 py-1 rounded-md bg-white/[0.04] border border-white/[0.08]">{f}</span>
            ))}
          </div>
        </motion.div>
      )}

      {/* Results */}
      <AnimatePresence>
        {phase === "done" && result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Token identity card */}
            <div className="p-4 rounded-2xl bg-card border border-border relative overflow-hidden">
              {/* Subtle glow */}
              <div
                className="absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-20 blur-2xl pointer-events-none"
                style={{
                  background: result.security.verdict === "SAFE" ? "#34d399" :
                    result.security.verdict === "CAUTION" ? "#fbbf24" : "#f87171"
                }}
              />
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className="h-12 w-12 rounded-xl overflow-hidden bg-muted border border-border shrink-0 flex items-center justify-center">
                  {result.meta.icon
                    ? <img src={result.meta.icon} alt="" className="w-full h-full object-cover" loading="lazy" />
                    : <span className="text-sm font-bold text-muted-foreground">{result.meta.symbol.slice(0, 2)}</span>
                  }
                </div>

                {/* Name + meta */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base font-bold text-foreground">{result.meta.name}</span>
                    <span className="text-xs text-muted-foreground font-mono">${result.meta.symbol}</span>
                    <VerdictBadge verdict={result.security.verdict} score={result.security.rugScore} />
                  </div>
                  {/* Mint address */}
                  <div className="flex items-center gap-2 mt-1.5">
                    <code className="text-[11px] font-mono text-muted-foreground/60">
                      {truncAddr(result.meta.mint, 8, 8)}
                    </code>
                    <button onClick={copyMint} className="text-muted-foreground/40 hover:text-primary transition-colors">
                      {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                    </button>
                    {result.market.dexUrl && (
                      <a href={result.market.dexUrl} target="_blank" rel="noopener noreferrer"
                        className="text-muted-foreground/40 hover:text-primary transition-colors">
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  {/* Socials */}
                  <div className="flex items-center gap-3 mt-2">
                    {result.meta.twitter && (
                      <a href={result.meta.twitter} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-blue-400 transition-colors">
                        <Twitter className="h-3 w-3" /> Twitter
                      </a>
                    )}
                    {result.meta.telegram && (
                      <a href={result.meta.telegram} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-blue-400 transition-colors">
                        <MessageCircle className="h-3 w-3" /> Telegram
                      </a>
                    )}
                    {result.meta.website && (
                      <a href={result.meta.website} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors">
                        <Globe className="h-3 w-3" /> Website
                      </a>
                    )}
                    {!result.meta.twitter && !result.meta.telegram && !result.meta.website && (
                      <span className="text-[11px] text-red-400/80 font-mono">⚠ No social links</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-white/[0.03] rounded-xl border border-white/[0.06]">
              {TABS.map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                    tab === t.key
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <t.icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{t.label}</span>
                </button>
              ))}
            </div>

            {/* Tab: Overview */}
            {tab === "overview" && (
              <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                {/* Score + quick checks */}
                <div className="p-4 rounded-2xl bg-card border border-border">
                  <div className="flex items-center gap-6">
                    <ScoreRing score={result.security.rugScore} />
                    <div className="flex-1 space-y-1">
                      <SecurityRow
                        label="Mint Authority"
                        ok={!result.security.mintAuthority}
                        value={result.security.mintAuthority ? "ENABLED" : "REVOKED"}
                      />
                      {result.meta.creatorBalance !== null && (
                        <SecurityRow
                          label="Dev Balance"
                          ok={result.meta.creatorBalance === 0}
                          warn={result.meta.creatorBalance !== null && result.meta.creatorBalance > 0}
                          value={result.meta.creatorBalance === 0
                            ? "0 ✓"
                            : result.meta.creatorBalance!.toLocaleString(undefined, { maximumFractionDigits: 0 }) + " tokens"}
                        />
                      )}
                      <SecurityRow
                        label="Freeze Authority"
                        ok={!result.security.freezeAuthority}
                        value={result.security.freezeAuthority ? "ENABLED" : "REVOKED"}
                      />
                      <SecurityRow
                        label="Liquidity Locked"
                        ok={result.security.lpLocked}
                        warn={!result.security.lpLocked}
                        value={result.security.lpLocked ? `${result.security.lpLockedPct.toFixed(0)}% locked` : "NOT LOCKED"}
                      />
                      <SecurityRow
                        label="Top 10 Holders"
                        ok={result.security.top10HolderPct < 50}
                        warn={result.security.top10HolderPct >= 50 && result.security.top10HolderPct < 70}
                        value={`${result.security.top10HolderPct.toFixed(1)}%`}
                      />
                    </div>
                  </div>
                </div>

                {/* Market stats grid */}
                <div className="grid grid-cols-2 gap-2">
                  <StatCard
                    label="Price"
                    value={fmtPrice(result.market.priceUsd)}
                    trend={result.market.priceChange24h != null ? (result.market.priceChange24h >= 0 ? "up" : "down") : null}
                    sub={result.market.priceChange24h != null ? `${result.market.priceChange24h >= 0 ? "+" : ""}${result.market.priceChange24h.toFixed(1)}% 24h` : undefined}
                    icon={TrendingUp}
                  />
                  <StatCard label="Market Cap"  value={fmt(result.market.marketCap)} icon={BarChart3} />
                  <StatCard label="Liquidity"   value={fmt(result.market.liquidity)} icon={Activity} />
                  <StatCard label="Volume 24h"  value={fmt(result.market.volume24h)} icon={BarChart3} />
                  {result.market.txns24h && (
                    <StatCard
                      label="Buy / Sell"
                      value={`${result.market.txns24h.buys} / ${result.market.txns24h.sells}`}
                      sub={`${((result.market.txns24h.buys / (result.market.txns24h.buys + result.market.txns24h.sells)) * 100).toFixed(0)}% buy pressure`}
                      icon={Activity}
                    />
                  )}
                  <StatCard
                    label="Token Age"
                    value={result.market.pairCreatedAt ? timeAgo(result.market.pairCreatedAt) : "—"}
                    icon={Info}
                  />
                </div>
              </motion.div>
            )}

            {/* Tab: Security */}
            {tab === "security" && (
              <motion.div key="security" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                <div className="p-4 rounded-2xl bg-card border border-border space-y-1">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono mb-3">Authority Checks</h3>
                  <SecurityRow label="Mint Authority" ok={!result.security.mintAuthority}
                    value={result.security.mintAuthority ? truncAddr(result.security.mintAuthority) : "Revoked ✓"} />
                  <SecurityRow label="Freeze Authority" ok={!result.security.freezeAuthority}
                    value={result.security.freezeAuthority ? truncAddr(result.security.freezeAuthority) : "Revoked ✓"} />
                  <SecurityRow label="LP Locked" ok={result.security.lpLocked} warn={!result.security.lpLocked}
                    value={result.security.lpLocked ? `${result.security.lpLockedPct.toFixed(1)}% locked` : "⚠ Not locked"} />
                  <SecurityRow label="Holders" ok={result.security.totalHolders > 100}
                    value={result.security.totalHolders > 0 ? result.security.totalHolders.toLocaleString() : "—"} />
                  <SecurityRow label="Insider Holdings" ok={result.security.insiderPct < 5}
                    warn={result.security.insiderPct >= 5 && result.security.insiderPct < 15}
                    value={`${result.security.insiderPct.toFixed(1)}%`} />
                  <SecurityRow label="Twitter"  ok={!!result.meta.twitter}  warn={!result.meta.twitter}  value={result.meta.twitter ? "Found" : "Not found"} />
                  <SecurityRow label="Website"  ok={!!result.meta.website}  warn={!result.meta.website}  value={result.meta.website ? "Found" : "Not found"} />
                  <SecurityRow label="Telegram" ok={!!result.meta.telegram} warn={!result.meta.telegram} value={result.meta.telegram ? "Found" : "Not found"} />
                </div>

                {result.meta.creator && (
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">Dev Wallet</span>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="text-xs font-mono text-foreground/70">{truncAddr(result.meta.creator, 8, 8)}</code>
                      <a href={`https://solscan.io/account/${result.meta.creator}`} target="_blank" rel="noopener noreferrer"
                        className="text-muted-foreground/40 hover:text-primary transition-colors">
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Tab: Holders */}
            {tab === "holders" && (
              <motion.div key="holders" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                {/* Summary */}
                {(() => {
                  const realHolders   = result.security.topHolders.filter(h => !h.isLP && h.type !== "system");
                  const lpHolders     = result.security.topHolders.filter(h => h.isLP);
                  const realTop10Pct  = realHolders.slice(0, 10).reduce((s, h) => s + h.pct, 0);
                  return (
                    <div className="grid grid-cols-2 gap-2">
                      <StatCard label="Total Holders" value={result.security.totalHolders > 0 ? result.security.totalHolders.toLocaleString() : "—"} icon={Users} />
                      <StatCard
                        label="Real Top 10"
                        value={`${realTop10Pct.toFixed(1)}%`}
                        sub="Excluding LP & system"
                        icon={Users}
                      />
                      <StatCard
                        label="LP Addresses"
                        value={lpHolders.length > 0 ? `${lpHolders.length} found` : "—"}
                        sub={lpHolders.length > 0
                          ? `${lpHolders.reduce((s, h) => s + h.pct, 0).toFixed(1)}% of supply`
                          : "None detected"}
                        icon={Lock}
                      />
                      <StatCard
                        label="LP Addresses"
                        value={lpHolders.length > 0 ? `${lpHolders.length} found` : "—"}
                        sub={lpHolders.length > 0 ? lpHolders.map(h => h.label || "LP").slice(0,2).join(", ") : undefined}
                        icon={Lock}
                      />
                      <StatCard label="Insider %" value={`${result.security.insiderPct.toFixed(1)}%`} icon={AlertTriangle} />
                    </div>
                  );
                })()}

                {/* Legend */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground font-mono px-1">
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-400 inline-block" /> LP Pool</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-purple-400 inline-block" /> Bonding Curve</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-400 inline-block" /> Insider</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-400 inline-block" /> Whale &gt;10%</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-400 inline-block" /> LP Pool</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-purple-400 inline-block" /> Bonding Curve</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-400 inline-block" /> System</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary inline-block" /> Holder</span>
                </div>
                {/* LP warning note */}
                {result.security.topHolders.some(h => h.isLP) && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-400/8 border border-blue-400/15 text-[11px] text-blue-400/80 font-mono">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0" />
                    LP & Bonding Curve addresses excluded from real holder calculation
                  </div>
                )}

                <div className="p-4 rounded-2xl bg-card border border-border">
                  {result.security.topHolders.length > 0 ? (
                    result.security.topHolders.map((h, i) => <HolderBar key={h.address} holder={h} i={i} />)
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No holder data available</p>
                  )}
                </div>
              </motion.div>
            )}

            {/* Tab: Clusters */}
            {tab === "clusters" && (
              <motion.div key="clusters" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">

                {/* Loading state */}
                {clusterLoading && (
                  <div className="flex flex-col items-center justify-center py-16 gap-4">
                    <div className="relative">
                      {[0,1,2].map(i => (
                        <motion.div key={i}
                          className="absolute rounded-full border border-primary/30"
                          style={{ width: 40 + i*24, height: 40 + i*24, top: -(i*12), left: -(i*12) }}
                          animate={{ scale: [1, 1.1, 1], opacity: [0.4, 0.8, 0.4] }}
                          transition={{ duration: 1.5, delay: i * 0.3, repeat: Infinity }}
                        />
                      ))}
                      <div className="relative z-10 h-10 w-10 flex items-center justify-center">
                        <Network className="h-5 w-5 text-primary" />
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-foreground">Mapping wallet clusters...</p>
                      <p className="text-xs text-muted-foreground mt-1 font-mono">
                        Tracing {result?.security.topHolders.filter(h => !h.isLP && h.type !== "system").slice(0, 12).length ?? 0} holder transactions on-chain
                      </p>
                      <p className="text-[11px] text-muted-foreground/50 mt-2 font-mono">This may take 20–40 seconds...</p>
                    </div>
                  </div>
                )}

                {/* Error state */}
                {!clusterLoading && clusterError && (
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <div>
                      <p className="font-semibold">Cluster scan failed</p>
                      <p className="text-xs mt-0.5 text-destructive/70 font-mono">{clusterError}</p>
                      <button
                        onClick={() => { setClusters(null); setClusterError(null); }}
                        className="text-xs text-destructive underline mt-1"
                      >
                        Retry
                      </button>
                    </div>
                  </div>
                )}

                {/* No clusters found */}
                {!clusterLoading && !clusterError && clusters && clusters.clusters.length === 0 && (
                  <div className="text-center py-12 p-4 rounded-2xl bg-card border border-emerald-400/20">
                    <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-emerald-400">No coordinated clusters detected</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Scanned {clusters.scanned} wallets — no shared funding source found
                    </p>
                  </div>
                )}

                {/* Cluster results */}
                {!clusterLoading && clusters && clusters.clusters.length > 0 && (
                  <>
                    {/* Summary banner */}
                    <div className={`flex items-center gap-3 p-3 rounded-xl border ${
                      clusters.hasRisk
                        ? "bg-red-400/8 border-red-400/20"
                        : "bg-yellow-400/8 border-yellow-400/20"
                    }`}>
                      <GitBranch className={`h-4 w-4 shrink-0 ${clusters.hasRisk ? "text-red-400" : "text-yellow-400"}`} />
                      <div className="flex-1">
                        <p className={`text-xs font-semibold font-mono ${clusters.hasRisk ? "text-red-400" : "text-yellow-400"}`}>
                          {clusters.clusters.length} cluster{clusters.clusters.length > 1 ? "s" : ""} detected
                          {" "}· {clusters.clusters.reduce((s, cl) => s + cl.members.length, 0)} wallets involved
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {clusters.clusters.reduce((s, cl) => s + cl.totalPct, 0).toFixed(1)}% of supply controlled by clusters
                        </p>
                      </div>
                    </div>

                    {/* Cluster cards */}
                    {clusters.clusters.map((cluster, ci) => {
                      const riskCfg = {
                        high:   { border: "border-red-400/25",    bg: "bg-red-400/[0.04]",    text: "text-red-400",    badge: "bg-red-400/15 text-red-400" },
                        medium: { border: "border-yellow-400/25", bg: "bg-yellow-400/[0.04]", text: "text-yellow-400", badge: "bg-yellow-400/15 text-yellow-400" },
                        low:    { border: "border-blue-400/25",   bg: "bg-blue-400/[0.04]",   text: "text-blue-400",   badge: "bg-blue-400/15 text-blue-400" },
                      }[cluster.riskLevel];

                      return (
                        <motion.div key={cluster.id}
                          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: ci * 0.08 }}
                          className={`rounded-2xl border ${riskCfg.border} ${riskCfg.bg} overflow-hidden`}
                        >
                          {/* Cluster header */}
                          <div className="p-4 pb-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <span className={`text-xs font-bold font-mono ${riskCfg.text}`}>{cluster.label}</span>
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono ${riskCfg.badge}`}>
                                    {cluster.riskLevel.toUpperCase()}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] text-muted-foreground font-mono">Funder:</span>
                                  <code className="text-[10px] font-mono text-foreground/60">{truncAddr(cluster.funder, 6, 4)}</code>
                                  <a href={`https://solscan.io/account/${cluster.funder}`} target="_blank" rel="noopener noreferrer"
                                    className="text-muted-foreground/30 hover:text-primary transition-colors">
                                    <ExternalLink className="h-2.5 w-2.5" />
                                  </a>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className={`text-lg font-bold font-mono ${riskCfg.text}`}>{cluster.totalPct.toFixed(1)}%</div>
                                <div className="text-[10px] text-muted-foreground">{cluster.members.length} wallets</div>
                              </div>
                            </div>

                            {/* Member addresses */}
                            <div className="flex flex-wrap gap-1 mt-3">
                              {cluster.members.slice(0, 5).map(addr => (
                                <a key={addr}
                                  href={`https://solscan.io/account/${addr}`}
                                  target="_blank" rel="noopener noreferrer"
                                  className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] text-muted-foreground/60 hover:text-primary hover:border-primary/30 transition-colors"
                                >
                                  {truncAddr(addr, 4, 3)}
                                </a>
                              ))}
                              {cluster.members.length > 5 && (
                                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] text-muted-foreground/40">
                                  +{cluster.members.length - 5} more
                                </span>
                              )}
                            </div>
                          </div>

                          {/* View detail button */}
                          <button
                            onClick={() => setSelectedCluster(cluster)}
                            className={`w-full flex items-center justify-between px-4 py-2.5 border-t ${riskCfg.border} bg-white/[0.02] hover:bg-white/[0.04] transition-colors text-xs font-mono`}
                          >
                            <span className={riskCfg.text}>View transaction flow →</span>
                            <span className="text-muted-foreground/50">{cluster.transfers.length} tx</span>
                          </button>
                        </motion.div>
                      );
                    })}

                    <p className="text-[11px] text-muted-foreground text-center font-mono py-1">
                      Scanned {clusters.scanned} wallets · {new Date(clusters.scanTimestamp).toLocaleTimeString()}
                    </p>
                  </>
                )}
              </motion.div>
            )}

            {/* Tab: Risk Feed */}
            {tab === "risks" && (
              <motion.div key="risks" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                {result.security.risks.length === 0 ? (
                  <div className="text-center py-10 p-4 rounded-2xl bg-card border border-emerald-400/20">
                    <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-emerald-400">No risks detected</p>
                    <p className="text-xs text-muted-foreground mt-1">RugCheck found no significant risk vectors for this token.</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3 px-1 pb-1">
                      {(["danger", "warn", "good"] as const).map(level => {
                        const count = result.security.risks.filter(r => r.level === level).length;
                        if (!count) return null;
                        const colors = { danger: "text-red-400", warn: "text-yellow-400", good: "text-emerald-400" };
                        return (
                          <span key={level} className={`text-xs font-mono font-semibold ${colors[level]}`}>
                            {count} {level}
                          </span>
                        );
                      })}
                    </div>
                    {/* Sort: danger first */}
                    {[...result.security.risks]
                      .sort((a, b) => {
                        const order = { danger: 0, warn: 1, good: 2 };
                        return order[a.level] - order[b.level];
                      })
                      .map((r, i) => (
                        <motion.div key={i} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                          <RiskTag risk={r} />
                        </motion.div>
                      ))
                    }
                  </>
                )}
              </motion.div>
            )}

            {/* Re-scan button */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-muted-foreground font-mono">
                Data sourced from RugCheck.xyz · DexScreener
              </span>
              <button
                onClick={() => scan(result.meta.mint)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors font-mono"
              >
                <RefreshCw className="h-3 w-3" /> Re-scan
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Cluster Flow Modal */}
      {ClusterFlowModal}
    </div>
  );
}