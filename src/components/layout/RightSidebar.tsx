import { useState, useEffect, useCallback, useRef } from "react";
import { Search, UserPlus, TrendingUp, Hash, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

// ── Global event untuk auto-detect token dari feed ──────────────────────────
// PostCard/TokenMention memanggil ini saat user klik token
export function emitTokenSelected(tokenAddress: string, symbol: string | null, name: string, icon: string | null) {
  window.dispatchEvent(new CustomEvent("xbags:token-selected", {
    detail: { tokenAddress, symbol, name, icon }
  }));
}

interface Profile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

interface TokenResult {
  tokenAddress: string;
  icon: string | null;
  name: string;
  symbol: string | null;
  priceUsd: string | null;
  marketCap: number | null;
}

interface TrendingTicker {
  symbol: string;
  count: number;
  priceUsd?: string | null;
  priceChange?: number | null;
  icon?: string | null;
  tokenAddress?: string;
}

interface TrendingHashtag {
  tag: string;
  count: number;
}

const RightSidebar = () => {
  const navigate = useNavigate();

  // ── Search ─────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [tokenResults, setTokenResults] = useState<TokenResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSearchResults([]);
      setTokenResults([]);
      return;
    }
    setSearching(true);
    const cleanQ = q.trim();
    try {
      const [userRes, tokenRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url, created_at, followers_count")
          .or(`username.ilike.%${cleanQ}%,display_name.ilike.%${cleanQ}%`)
          .limit(5),
        supabase.functions.invoke("search-tokens", { body: { query: cleanQ } }),
      ]);
      setSearchResults(userRes.data || []);
      if (tokenRes.data?.success && Array.isArray(tokenRes.data.tokens)) {
        setTokenResults(tokenRes.data.tokens.slice(0, 5));
      } else {
        setTokenResults([]);
      }
    } catch {
      setSearchResults([]);
      setTokenResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => handleSearch(searchQuery), 500);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [searchQuery, handleSearch]);

  const handleTokenClick = (token: TokenResult) => {
    navigate(`/market?token=${token.tokenAddress}`);
    setSearchQuery("");
    setTokenResults([]);
    setSearchResults([]);
  };

  // ── TOP CREATORS ──────────────────────
  const [newUsers, setNewUsers] = useState<Profile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  useEffect(() => {
    const fetchNewUsers = async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url, created_at, followers_count")
          .order("followers_count", { ascending: false })
          .limit(5);
        setNewUsers((data || []).filter(u => u.username));
      } catch {
        // silent
      } finally {
        setLoadingUsers(false);
      }
    };
    fetchNewUsers();
    const interval = setInterval(fetchNewUsers, 60_000);
    return () => clearInterval(interval);
  }, []);

  // ── Trending Tickers dari feed ─────────
  const [trendingTickers, setTrendingTickers] = useState<TrendingTicker[]>([]);
  const [loadingTickers, setLoadingTickers] = useState(true);

  useEffect(() => {
    const fetchTrendingTickers = async () => {
      try {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data } = await supabase
          .from("posts")
          .select("content")
          .eq("is_published", true)
          .gte("created_at", since)
          .limit(200);

        if (!data) return;

        // Extract semua $TICKER dari content post
        const tickerMap = new Map<string, number>();
        data.forEach(({ content }) => {
          const matches = content.match(/\$([A-Z]{1,10})(?![A-Za-z])/g) || [];
          matches.forEach(m => {
            const sym = m.slice(1).toUpperCase();
            tickerMap.set(sym, (tickerMap.get(sym) || 0) + 1);
          });
        });

        // Urutkan berdasarkan jumlah sebutan, ambil top 6
        const sorted = [...tickerMap.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6);

        if (sorted.length === 0) {
          setLoadingTickers(false);
          return;
        }

        // Fetch harga live untuk tiap ticker
        const enriched = await Promise.all(
          sorted.map(async ([symbol, count]) => {
            try {
              const { data: res } = await supabase.functions.invoke("search-tokens", {
                body: { query: symbol },
              });
              if (res?.success && res.tokens?.length > 0) {
                // Pilih token dengan liquidity tertinggi
                const best = res.tokens
                  .filter((t: any) => t.symbol?.toUpperCase() === symbol)
                  .sort((a: any, b: any) => (b.liquidity || 0) - (a.liquidity || 0))[0]
                  || res.tokens[0];
                return {
                  symbol,
                  count,
                  priceUsd: best.priceUsd,
                  priceChange: best.priceChange?.h24,
                  icon: best.icon,
                  tokenAddress: best.tokenAddress,
                };
              }
            } catch {}
            return { symbol, count };
          })
        );

        setTrendingTickers(enriched);
      } catch {
        // silent
      } finally {
        setLoadingTickers(false);
      }
    };

    fetchTrendingTickers();
    const interval = setInterval(fetchTrendingTickers, 5 * 60_000);
    return () => clearInterval(interval);
  }, []);

  // ── Trending Hashtags dari feed ────────
  const [trendingHashtags, setTrendingHashtags] = useState<TrendingHashtag[]>([]);
  const [loadingHashtags, setLoadingHashtags] = useState(true);

  useEffect(() => {
    const fetchTrendingHashtags = async () => {
      try {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data } = await supabase
          .from("posts")
          .select("content")
          .eq("is_published", true)
          .gte("created_at", since)
          .limit(200);

        if (!data) return;

        const tagMap = new Map<string, number>();
        data.forEach(({ content }) => {
          const matches = content.match(/#([a-zA-Z0-9_]{1,30})(?![a-zA-Z0-9_])/g) || [];
          matches.forEach(m => {
            const tag = m.slice(1).toLowerCase();
            tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
          });
        });

        const sorted = [...tagMap.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([tag, count]) => ({ tag, count }));

        setTrendingHashtags(sorted);
      } catch {
        // silent
      } finally {
        setLoadingHashtags(false);
      }
    };

    fetchTrendingHashtags();
    const interval = setInterval(fetchTrendingHashtags, 5 * 60_000);
    return () => clearInterval(interval);
  }, []);

  // ── Auto-detect token dari feed (untuk fitur masa depan) ──
  const [detectedToken, setDetectedToken] = useState<{
    tokenAddress: string;
    symbol: string | null;
    name: string;
    icon: string | null;
  } | null>(null);

  // Listen event dari feed saat user klik token
  useEffect(() => {
    const handler = (e: Event) => {
      const { tokenAddress, symbol, name, icon } = (e as CustomEvent).detail;
      setDetectedToken({ tokenAddress, symbol, name, icon });
    };
    window.addEventListener("xbags:token-selected", handler);
    return () => window.removeEventListener("xbags:token-selected", handler);
  }, []);

  const getInitials = (p: Profile) => {
    const name = p.display_name || p.username || "?";
    return name.slice(0, 2).toUpperCase();
  };

  const formatPrice = (p: string | null | undefined) => {
    if (!p) return "—";
    const n = parseFloat(p);
    if (isNaN(n) || n === 0) return "$0";
    if (n >= 1) return `$${n.toFixed(2)}`;
    if (n >= 0.01) return `$${n.toFixed(4)}`;
    if (n >= 0.0001) return `$${n.toFixed(6)}`;
    const fixed = n.toFixed(20);
    const match = fixed.match(/^0\.(0+)([1-9]\d{0,3})/);
    if (match) {
      const sub = match[1].length.toString().split("").map(d => "₀₁₂₃₄₅₆₇₈₉"[parseInt(d)]).join("");
      return `$0.0${sub}${match[2]}`;
    }
    return `$${n.toExponential(2)}`;
  };

  const formatMcap = (m: number | null) => {
    if (!m || m <= 0) return "";
    if (m >= 1_000_000_000) return `$${(m / 1_000_000_000).toFixed(1)}B`;
    if (m >= 1_000_000) return `$${(m / 1_000_000).toFixed(1)}M`;
    if (m >= 1_000) return `$${(m / 1_000).toFixed(0)}K`;
    return `$${m.toFixed(0)}`;
  };

  return (
    <aside className="hidden lg:flex flex-col w-80 xl:w-[340px] border-l border-border bg-background h-screen sticky top-0 shrink-0 overflow-y-auto">
      <div className="p-4 space-y-4">

        {/* ── Search ────────────────────── */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search users or tokens..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-card border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
          />
          {searchQuery.trim() && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
              {searching ? (
                <div className="p-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Searching...
                </div>
              ) : (
                <>
                  {tokenResults.length > 0 && (
                    <>
                      <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/30">Tokens</div>
                      {tokenResults.map((token) => (
                        <button
                          key={token.tokenAddress}
                          onClick={() => handleTokenClick(token)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
                        >
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-primary shrink-0 overflow-hidden">
                            {token.icon ? (
                              <img src={token.icon} alt="" className="h-full w-full object-cover rounded-full" />
                            ) : (
                              (token.symbol || "?").slice(0, 2).toUpperCase()
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-foreground truncate">{token.name}</div>
                            <div className="text-xs text-muted-foreground">${token.symbol || "???"}</div>
                          </div>
                          {token.marketCap && (
                            <span className="text-xs text-muted-foreground">{formatMcap(token.marketCap)}</span>
                          )}
                        </button>
                      ))}
                    </>
                  )}
                  {searchResults.length > 0 && (
                    <>
                      <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/30">Users</div>
                      {searchResults.map((user) => (
                        <button
                          key={user.id}
                          onClick={() => {
                            navigate(`/profile/${user.username || user.id}`);
                            setSearchQuery("");
                            setSearchResults([]);
                            setTokenResults([]);
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
                        >
                          <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0 overflow-hidden">
                            {user.avatar_url ? (
                              <img src={user.avatar_url} alt="" className="h-full w-full object-cover rounded-full" />
                            ) : (
                              getInitials(user)
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-foreground truncate">{user.display_name || user.username || "Anonymous"}</div>
                            {user.username && <div className="text-xs text-muted-foreground">@{user.username}</div>}
                          </div>
                        </button>
                      ))}
                    </>
                  )}
                  {tokenResults.length === 0 && searchResults.length === 0 && (
                    <div className="p-3 text-sm text-muted-foreground">No results found</div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* ── TOP CREATORS ────────────── */}
        <div className="rounded-xl bg-card border border-border p-4">
          <div className="flex items-center gap-2 mb-3">
            <UserPlus className="h-4 w-4 text-primary" />
            <h3 className="font-bold text-sm text-foreground">WHO TO FOLLOW</h3>
          </div>
          {loadingUsers ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-3.5 w-20" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <Skeleton className="h-8 w-16 rounded-full" />
                </div>
              ))}
            </div>
          ) : newUsers.length === 0 ? (
            <p className="text-xs text-muted-foreground">No new users yet</p>
          ) : (
            <div className="space-y-3">
              {newUsers.map((user) => (
                <div key={user.id} className="flex items-center gap-3">
                  <button
                    onClick={() => navigate(`/profile/${user.username || user.id}`)}
                    className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0 overflow-hidden"
                  >
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt="" className="h-full w-full object-cover rounded-full" />
                    ) : (
                      getInitials(user)
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground truncate">
                      {user.display_name || user.username || "Anonymous"}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      @{user.username || "user"} � {(user as any).followers_count ?? 0} followers
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="h-8 px-4 text-xs bg-primary text-primary-foreground hover:bg-secondary rounded-full"
                    onClick={() => navigate(`/profile/${user.username || user.id}`)}
                  >
                    Follow
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Trending Tickers ─────────── */}
        <div className="rounded-xl bg-card border border-border p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h3 className="font-bold text-sm text-foreground">TRENDING TICKERS</h3>
            <span className="text-[10px] text-muted-foreground ml-auto">24h</span>
          </div>
          {loadingTickers ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8 w-full rounded-lg" />)}
            </div>
          ) : trendingTickers.length === 0 ? (
            <p className="text-xs text-muted-foreground">No tickers mentioned yet</p>
          ) : (
            <div className="space-y-1.5">
              {trendingTickers.map((t, i) => (
                <button
                  key={t.symbol}
                  onClick={() => t.tokenAddress
                    ? navigate(`/market?token=${t.tokenAddress}`)
                    : navigate(`/market`)
                  }
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-muted/40 transition-colors group"
                >
                  <span className="text-[11px] text-muted-foreground w-4 shrink-0">#{i + 1}</span>
                  <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                    {t.icon
                      ? <img src={t.icon} alt="" className="h-full w-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                      : <span className="text-[9px] font-bold text-primary">{t.symbol.slice(0, 2)}</span>
                    }
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <span className="text-sm font-semibold text-primary">${t.symbol}</span>
                    <span className="text-[10px] text-muted-foreground ml-1.5">{t.count} post{t.count > 1 ? "s" : ""}</span>
                  </div>
                  <div className="text-right shrink-0">
                    {t.priceUsd && <div className="text-xs font-mono text-foreground">{formatPrice(t.priceUsd)}</div>}
                    {t.priceChange != null && (
                      <div className={`text-[10px] font-medium ${t.priceChange >= 0 ? "text-green-400" : "text-destructive"}`}>
                        {t.priceChange >= 0 ? "+" : ""}{t.priceChange.toFixed(1)}%
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Trending Hashtags ─────────── */}
        <div className="rounded-xl bg-card border border-border p-4">
          <div className="flex items-center gap-2 mb-3">
            <Hash className="h-4 w-4 text-primary" />
            <h3 className="font-bold text-sm text-foreground">TRENDING TOPICS</h3>
            <span className="text-[10px] text-muted-foreground ml-auto">24h</span>
          </div>
          {loadingHashtags ? (
            <div className="flex flex-wrap gap-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-7 w-20 rounded-full" />)}
            </div>
          ) : trendingHashtags.length === 0 ? (
            <p className="text-xs text-muted-foreground">No hashtags yet</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {trendingHashtags.map((h) => (
                <button
                  key={h.tag}
                  onClick={() => navigate(`/feed`)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-muted/40 border border-border hover:border-primary/40 hover:bg-primary/10 hover:text-primary transition-colors text-xs text-muted-foreground"
                >
                  <span className="text-primary font-semibold">#</span>{h.tag}
                  <span className="text-[10px] opacity-60 ml-0.5">{h.count}</span>
                </button>
              ))}
            </div>
          )}
        </div>

      </div>
    </aside>
  );
};

export default RightSidebar;