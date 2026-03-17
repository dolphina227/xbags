import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Search, TrendingUp, Sparkles, Globe,
  ArrowUp, ArrowDown, RefreshCw, Loader2,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import TokenDetail from "@/components/market/TokenDetail";

interface Token {
  tokenAddress: string;
  icon: string | null;
  name: string;
  symbol: string | null;
  priceUsd: string | null;
  priceChange: {
    m5?: number | null;
    h1?: number | null;
    h6?: number | null;
    h24?: number | null;
  } | null;
  marketCap: number | null;
  fdv?: number | null;
  volume24h?: number | null;
  liquidity?: number | null;
  pairCreatedAt?: number | null;
  boostAmount?: number;
  url?: string;
}

type TabKey = "new" | "trending" | "all";
type Timeframe = "5m" | "1h" | "6h" | "24h";

const TABS = [
  { key: "new" as TabKey, label: "New", icon: Sparkles },
  { key: "trending" as TabKey, label: "Trending", icon: TrendingUp },
  { key: "all" as TabKey, label: "All Tokens", icon: Globe },
] as const;

const TIMEFRAMES: { key: Timeframe; label: string }[] = [
  { key: "5m", label: "5m" },
  { key: "1h", label: "1h" },
  { key: "6h", label: "6h" },
  { key: "24h", label: "24h" },
];

const CACHE_TTL = 10_000;
const AUTO_REFRESH = 30_000;

function formatPrice(p: string | null): string {
  if (!p) return "—";
  const n = parseFloat(p);
  if (isNaN(n) || n === 0) return "$0";
  if (n >= 1_000) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.1) return `$${n.toFixed(4)}`;
  if (n >= 0.01) return `$${n.toFixed(5)}`;
  const fixed = n.toFixed(12);
  const match = fixed.match(/^0\.(0*)([1-9]\d{0,3})/);
  if (match) {
    const totalDecimals = match[1].length + match[2].length;
    return `$${n.toFixed(Math.min(totalDecimals + 1, 10))}`;
  }
  return `$${n.toExponential(2)}`;
}

function formatMcap(m: number | null | undefined): string {
  if (!m || m <= 0) return "N/A";
  if (m >= 1_000_000_000) return `$${(m / 1_000_000_000).toFixed(2)}B`;
  if (m >= 1_000_000) return `$${(m / 1_000_000).toFixed(1)}M`;
  if (m >= 1_000) return `$${(m / 1_000).toFixed(0)}K`;
  return `$${m.toFixed(0)}`;
}

function getChange(token: Token, tf: Timeframe): number | null {
  if (!token.priceChange) return null;
  switch (tf) {
    case "5m": return token.priceChange.m5 ?? null;
    case "1h": return token.priceChange.h1 ?? null;
    case "6h": return token.priceChange.h6 ?? null;
    case "24h": return token.priceChange.h24 ?? null;
    default: return null;
  }
}

function TableHeader() {
  return (
    <div className="flex items-center gap-2 py-2 px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold border-b border-border">
      <span className="w-6 text-center">#</span>
      <span className="w-8" />
      <span className="flex-1">Token</span>
      <span className="w-20 text-right">Price</span>
      <span className="w-16 text-right">Change</span>
      <span className="w-20 text-right hidden sm:block">MCap</span>
    </div>
  );
}

export default function MarketPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabKey>("new");
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);

  // Search tokens via edge function (same as home sidebar)
  const [searchTokenResults, setSearchTokenResults] = useState<Token[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Handle ?token= query param from search
  useEffect(() => {
    const tokenAddr = searchParams.get("token");
    if (tokenAddr && !selectedToken) {
      supabase.functions.invoke("search-tokens", {
        body: { query: tokenAddr },
      }).then(({ data }) => {
        if (data?.success && data.tokens?.length > 0) {
          setSelectedToken(data.tokens[0]);
          setSearchParams({}, { replace: true });
        }
      });
    }
  }, [searchParams]);

  // Search with edge function when query changes
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!search.trim() || search.trim().length < 2) {
      setSearchTokenResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const { data } = await supabase.functions.invoke("search-tokens", {
          body: { query: search.trim() },
        });
        if (data?.success && Array.isArray(data.tokens)) {
          setSearchTokenResults(data.tokens);
        } else {
          setSearchTokenResults([]);
        }
      } catch {
        setSearchTokenResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 500);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [search]);

  const [tfNew, setTfNew] = useState<Timeframe>("1h");
  const [tfTrending, setTfTrending] = useState<Timeframe>("1h");
  const [tfAll, setTfAll] = useState<Timeframe>("24h");

  const currentTf = activeTab === "new" ? tfNew : activeTab === "trending" ? tfTrending : tfAll;

  const setCurrentTf = useCallback(
    (tf: Timeframe) => {
      if (activeTab === "new") setTfNew(tf);
      else if (activeTab === "trending") setTfTrending(tf);
      else setTfAll(tf);
    },
    [activeTab]
  );

  const cache = useRef<Map<string, { data: Token[]; ts: number }>>(new Map());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchTokens = useCallback(
    async (tab: TabKey, tf: Timeframe, silent = false) => {
      const cacheKey = tab === "all" ? "all" : `${tab}-${tf}`;
      const cached = cache.current.get(cacheKey);
      if (cached && Date.now() - cached.ts < CACHE_TTL) {
        setTokens(cached.data);
        setLoading(false);
        return;
      }
      if (!silent) setLoading(true);
      setError(null);
      try {
        const { data, error: fnError } = await supabase.functions.invoke("fetch-tokens", {
          body: { type: tab, timeframe: tab !== "all" ? tf : undefined },
        });
        if (fnError) throw new Error(fnError.message);
        if (!data?.success) throw new Error(data?.error || "Fetch failed");
        const result: Token[] = data.tokens ?? [];
        cache.current.set(cacheKey, { data: result, ts: Date.now() });
        setTokens(result);
      } catch (err: any) {
        console.error("fetchTokens error:", err);
        setError("Failed to load data. Try again.");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchTokens(activeTab, currentTf);
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [activeTab, currentTf, fetchTokens]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchTokens(activeTab, currentTf, true);
    }, AUTO_REFRESH);
    return () => clearInterval(interval);
  }, [activeTab, currentTf, fetchTokens]);

  // Use search results if searching, otherwise filter local tokens
  const displayTokens = search.trim().length >= 2
    ? searchTokenResults
    : tokens.filter((t) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return t.name?.toLowerCase().includes(q) || t.symbol?.toLowerCase().includes(q) || t.tokenAddress?.toLowerCase().includes(q);
      });

  // ── Token Detail View
  if (selectedToken) {
    return <TokenDetail token={selectedToken} onBack={() => setSelectedToken(null)} />;
  }

  return (
    <div className="py-4">
      <h1 className="text-xl font-bold mb-4">Market</h1>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search token name, $ticker, or paste address..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-card border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
        />
        {searchLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-3 overflow-x-auto no-scrollbar">
        {TABS.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors active:scale-95 whitespace-nowrap shrink-0 ${
              activeTab === tab.key ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}>
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Timeframe pills */}
      <div className="flex gap-1.5 mb-4">
        {TIMEFRAMES.map((t) => (
          <button key={t.key} onClick={() => setCurrentTf(t.key)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              currentTf === t.key ? "bg-primary/20 text-primary border border-primary/30" : "bg-muted/30 text-muted-foreground border border-transparent hover:text-foreground"
            }`}>{t.label}</button>
        ))}
      </div>

      {/* Error */}
      {error && !loading && (
        <div className="flex flex-col items-center gap-3 py-12">
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={() => fetchTokens(activeTab, currentTf)} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      )}

      {/* Loading */}
      {loading && tokens.length === 0 && !error && (
        <div>
          <TableHeader />
          {[...Array(7)].map((_, i) => (
            <div key={i} className="flex items-center gap-2 py-2.5 px-3 border-b border-border">
              <Skeleton className="w-6 h-4" />
              <Skeleton className="w-8 h-8 rounded-full" />
              <div className="flex-1 space-y-1"><Skeleton className="h-3.5 w-24" /><Skeleton className="h-3 w-14" /></div>
              <Skeleton className="w-16 h-4" />
              <Skeleton className="w-14 h-4" />
              <Skeleton className="w-16 h-4 hidden sm:block" />
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && !error && displayTokens.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground">No tokens found</p>
        </div>
      )}

      {/* Token list */}
      {!error && displayTokens.length > 0 && (
        <div>
          <TableHeader />
          {displayTokens.map((token, i) => {
            const change = getChange(token, currentTf);
            const isPositive = (change ?? 0) >= 0;
            const mcap = token.marketCap || token.fdv || null;
            const showNewBadge = activeTab === "new" && !!token.pairCreatedAt && Date.now() - token.pairCreatedAt < 3_600_000;
            return (
              <motion.div key={token.tokenAddress} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                onClick={() => setSelectedToken(token)}
                className="flex items-center gap-2 py-2.5 px-3 border-b border-border hover:bg-muted/20 active:bg-muted/40 cursor-pointer transition-colors">
                <span className="w-6 text-center text-[10px] text-muted-foreground">{i + 1}</span>
                <div className="w-8 h-8 rounded-full overflow-hidden bg-card border border-border flex items-center justify-center shrink-0">
                  {token.icon ? (
                    <img src={token.icon} alt="" className="w-full h-full object-cover" loading="lazy"
                      onError={(e) => { const el = e.currentTarget; el.style.display = "none"; }} />
                  ) : (
                    <span className="text-[10px] font-bold text-primary">{(token.symbol || token.name || "?").slice(0, 2).toUpperCase()}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-foreground truncate">{token.name || "Unknown"}</span>
                    {showNewBadge && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-primary/20 text-primary uppercase">NEW</span>}
                  </div>
                  <span className="text-[10px] text-muted-foreground">${token.symbol || "???"}</span>
                </div>
                <div className="w-20 text-right"><span className="text-xs font-mono text-foreground">{formatPrice(token.priceUsd)}</span></div>
                <div className="w-16 text-right">
                  {change !== null ? (
                    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${isPositive ? "text-success" : "text-destructive"}`}>
                      {isPositive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                      {Math.abs(change).toFixed(1)}%
                    </span>
                  ) : <span className="text-xs text-muted-foreground">—</span>}
                </div>
                <div className="w-20 text-right hidden sm:block"><span className="text-xs text-muted-foreground">{formatMcap(mcap)}</span></div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
