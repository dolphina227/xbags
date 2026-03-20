import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart, MessageCircle, Share2, Eye, MoreHorizontal,
  Trash2, Diamond, Repeat2, Link2, ExternalLink,
  TrendingUp, TrendingDown, Loader2, X, Copy, Users, Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Post, feedAPI } from "@/lib/api/feed";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import CommentSection from "./CommentSection";
import TipModal from "./TipModal";
import QuoteModal from "./QuoteModal";
import EmbeddedPost from "./EmbeddedPost";

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return "Just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n > 0 ? String(n) : "";
}

function getSessionId(): string {
  const KEY = "xbags_sid";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

// ─────────────────────────────────────────────────────────────────────────────
// Token Hover Popup helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatPrice(p: string | null): string {
  if (!p) return "—";
  const n = parseFloat(p);
  if (isNaN(n) || n === 0) return "$0";
  if (n >= 1_000) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  if (n >= 0.0001) return `$${n.toFixed(6)}`;
  // Untuk harga sangat kecil: gunakan subscript Unicode untuk jumlah nol
  const fixed = n.toFixed(20);
  const match = fixed.match(/^0\.(0+)([1-9]\d{0,3})/);
  if (match) {
    const zeros = match[1].length;
    const sig = match[2];
    // Subscript Unicode digits
    const sub = zeros.toString().split("").map(d => "₀₁₂₃₄₅₆₇₈₉"[parseInt(d)]).join("");
    return `$0.0${sub}${sig}`;
  }
  return `$${n.toExponential(2)}`;
}

function formatLarge(m: number | null | undefined): string {
  if (!m || m <= 0) return "N/A";
  if (m >= 1_000_000_000) return `$${(m / 1_000_000_000).toFixed(2)}B`;
  if (m >= 1_000_000) return `$${(m / 1_000_000).toFixed(1)}M`;
  if (m >= 1_000) return `$${(m / 1_000).toFixed(0)}K`;
  return `$${m.toFixed(0)}`;
}

function truncateAddress(addr: string): string {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// ── Token legitimacy filter ───────────────────────────────────────────────────
// Menilai apakah token kemungkinan asli berdasarkan data DexScreener
interface LegitResult {
  isLegit: boolean;
  warnings: string[];
}

function checkTokenLegit(data: TokenHoverData): LegitResult {
  const warnings: string[] = [];

  // Liquidity terlalu rendah — tanda token scam/honeypot
  if (!data.liquidity || data.liquidity < 1000) {
    warnings.push("Very low liquidity");
  }

  // Tidak ada volume 24h — tidak ada aktivitas nyata
  if (!data.volume24h || data.volume24h < 100) {
    warnings.push("No trading activity");
  }

  // Tidak ada market cap
  if (!data.marketCap && !data.fdv) {
    warnings.push("No market cap data");
  }

  // Tidak ada pair creation date — kemungkinan tidak valid
  if (!data.pairCreatedAt) {
    warnings.push("Unverified pair");
  }

  // Tidak ada harga
  if (!data.priceUsd || parseFloat(data.priceUsd) === 0) {
    warnings.push("No price data");
  }

  // Jika lebih dari 2 warning → kemungkinan scam
  const isLegit = warnings.length <= 1;
  return { isLegit, warnings };
}

interface TokenHoverData {
  tokenAddress: string;
  name: string;
  symbol: string | null;
  icon: string | null;
  priceUsd: string | null;
  priceChange: {
    m5?: number | null;
    h1?: number | null;
    h6?: number | null;
    h24?: number | null;
  } | null;
  marketCap: number | null;
  fdv: number | null;
  volume24h: number | null;
  liquidity: number | null;
  url?: string | null;
  // Extended fields from DexScreener pair info
  pairCreatedAt?: number | null;
  txns?: { h24?: { buys?: number; sells?: number } } | null;
  // Social links extracted from DexScreener info
  socials?: { type: string; url: string }[];
  websites?: { url: string }[];
}

function PctBadge({ value, label }: { value: number | null | undefined; label: string }) {
  if (value == null) return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[9px] text-muted-foreground">{label}</span>
      <span className="text-[11px] text-muted-foreground font-mono">—</span>
    </div>
  );
  const pos = value >= 0;
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[9px] text-muted-foreground">{label}</span>
      <span className={`text-[11px] font-bold flex items-center gap-0.5 ${pos ? "text-success" : "text-destructive"}`}>
        {pos ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
        {Math.abs(value).toFixed(1)}%
      </span>
    </div>
  );
}

// ── TokenHoverCard ────────────────────────────────────────────────────────────
// Renders a rich popup anchored below/above the $TICKER span on hover

interface TokenHoverCardProps {
  ticker: string;
  anchorRect: DOMRect;
  onClose: () => void;
  onNavigate: (address: string) => void;
  onCancelHide: () => void;
}

function TokenHoverCard({ ticker, anchorRect, onClose, onNavigate, onCancelHide }: TokenHoverCardProps) {
  const [data, setData] = useState<TokenHoverData | null>(null);
  const [allTokens, setAllTokens] = useState<TokenHoverData[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Position: appear below the anchor, shift left if near edge
  const CARD_W = 320;
  const CARD_H = 340;
  const vw = typeof window !== "undefined" ? window.innerWidth : 800;
  const vh = typeof window !== "undefined" ? window.innerHeight : 600;
  let left = anchorRect.left;
  if (left + CARD_W > vw - 12) left = vw - CARD_W - 12;
  if (left < 12) left = 12;
  const spaceBelow = vh - anchorRect.bottom;
  const above = spaceBelow < CARD_H + 12;
  const top = above ? anchorRect.top - CARD_H - 6 : anchorRect.bottom + 6;

  // Fetch token data once on mount — pisahkan logika CA vs $TICKER
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: res } = await supabase.functions.invoke("search-tokens", {
          body: { query: ticker },
        });
        if (cancelled) return;
        if (!res?.success || !res.tokens?.length) {
          setNotFound(true);
          return;
        }

        const tokens: TokenHoverData[] = res.tokens;

        // Deteksi apakah query adalah Solana CA (address 32-44 char base58)
        const isAddress = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(ticker);

        if (isAddress) {
          // CA: langsung ambil token pertama yang cocok addressnya
          const exact = tokens.find(t => t.tokenAddress === ticker) || tokens[0];
          setAllTokens([exact]);
          setData(exact);
        } else {
          // $TICKER: filter hanya yang simbolnya sama persis
          const sameSymbol = tokens.filter(
            t => t.symbol?.toUpperCase() === ticker.toUpperCase()
          );
          const pool = sameSymbol.length > 0 ? sameSymbol : tokens;

          // Scoring ketat: liquidity paling penting, lalu volume, lalu mcap
          // Token tanpa liquidity/volume nyata mendapat skor 0
          const scored = [...pool].sort((a, b) => {
            const liqA = (a.liquidity || 0) >= 500 ? a.liquidity! : 0;
            const liqB = (b.liquidity || 0) >= 500 ? b.liquidity! : 0;
            const volA = (a.volume24h || 0) >= 100 ? a.volume24h! : 0;
            const volB = (b.volume24h || 0) >= 100 ? b.volume24h! : 0;
            const scoreA = liqA * 3 + volA * 2 + (a.marketCap || 0);
            const scoreB = liqB * 3 + volB * 2 + (b.marketCap || 0);
            return scoreB - scoreA;
          });

          setAllTokens(scored);
          setData(scored[0]);
        }
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [ticker]);

  // Mouse-leave logic: close only if pointer leaves BOTH the anchor area AND the card
  // We rely on the parent managing close via onMouseLeave, but add a safety timeout
  useEffect(() => {
    hideTimer.current = setTimeout(onClose, 6000); // auto-close after 6s idle
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [onClose]);

  const resetTimer = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(onClose, 6000);
  };

  const handleCopy = () => {
    if (!data?.tokenAddress) return;
    navigator.clipboard.writeText(data.tokenAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, scale: 0.95, y: above ? 4 : -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: above ? 4 : -4 }}
      transition={{ duration: 0.13, ease: "easeOut" }}
      onMouseEnter={() => { onCancelHide(); resetTimer(); }}
      onMouseLeave={onClose}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "fixed",
        top,
        left,
        width: CARD_W,
        zIndex: 9999,
        transformOrigin: above ? "bottom left" : "top left",
      }}
      className="bg-card border border-border rounded-xl shadow-modal overflow-hidden"
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border bg-muted/20">
        <div className="flex items-center gap-2 min-w-0">
          {data?.icon ? (
            <img src={data.icon} alt="" className="h-6 w-6 rounded-full object-cover shrink-0 border border-border"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
          ) : (
            <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <span className="text-[9px] font-bold text-primary">
                {(data?.symbol || ticker).slice(0, 2).toUpperCase()}
              </span>
            </div>
          )}
          <div className="min-w-0">
            <span className="text-sm font-bold text-primary">
              ${(data?.symbol || ticker).toUpperCase()}
            </span>
            {data && <span className="text-xs text-muted-foreground ml-1.5 truncate">{data.name}</span>}
          </div>
        </div>
        <button onClick={onClose}
          className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── Body ── */}
      <div className="p-3 space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">Fetching market data...</span>
          </div>
        ) : notFound || !data ? (
          <div className="text-center py-6">
            <p className="text-xs font-medium text-foreground mb-1">Token not found</p>
            <p className="text-[11px] text-muted-foreground">Not listed on DexScreener yet</p>
          </div>
        ) : (
          <>
            {/* ── Legitimacy warning ── */}
            {(() => {
              const { isLegit, warnings } = checkTokenLegit(data);
              if (isLegit) return null;
              return (
                <div className="flex items-start gap-2 px-2.5 py-2 rounded-lg bg-destructive/10 border border-destructive/30">
                  <span className="text-destructive text-sm shrink-0">⚠️</span>
                  <div>
                    <p className="text-[10px] font-bold text-destructive uppercase tracking-wide">Possible scam token</p>
                    <p className="text-[10px] text-destructive/80 mt-0.5">{warnings.join(" · ")}</p>
                  </div>
                </div>
              );
            })()}

            {/* Price + 24h change */}
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Price</p>
                <p className="text-xl font-bold text-foreground font-mono leading-none">{formatPrice(data.priceUsd)}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">MCap</p>
                <p className="text-sm font-semibold text-foreground">{formatLarge(data.marketCap)}</p>
              </div>
            </div>

            {/* % change row: 5m / 1h / 6h / 24h */}
            <div className="grid grid-cols-4 gap-1 p-2 rounded-lg bg-muted/30 border border-border/40">
              <PctBadge value={data.priceChange?.m5} label="5m" />
              <PctBadge value={data.priceChange?.h1} label="1h" />
              <PctBadge value={data.priceChange?.h6} label="6h" />
              <PctBadge value={data.priceChange?.h24} label="24h" />
            </div>

            {/* Stats grid: FDV / Vol24h / Liquidity */}
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { label: "FDV", value: formatLarge(data.fdv) },
                { label: "Vol 24h", value: formatLarge(data.volume24h) },
                { label: "Liquidity", value: formatLarge(data.liquidity) },
              ].map((s) => (
                <div key={s.label} className="text-center p-1.5 rounded-lg bg-muted/20 border border-border/30">
                  <p className="text-[9px] text-muted-foreground mb-0.5">{s.label}</p>
                  <p className="text-xs font-semibold text-foreground">{s.value}</p>
                </div>
              ))}
            </div>

            {/* Contract address */}
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-muted/20 border border-border/30">
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider shrink-0">CA</span>
              <span className="text-xs font-mono text-foreground flex-1 truncate">{truncateAddress(data.tokenAddress)}</span>
              <button onClick={handleCopy}
                className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
                title="Copy contract address">
                {copied
                  ? <span className="text-[9px] text-success font-semibold">Copied!</span>
                  : <Copy className="h-3 w-3" />}
              </button>
            </div>

            {/* Social links + Trade button */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => onNavigate(data.tokenAddress)}
                className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-secondary transition-colors"
              >
                Trade ${(data.symbol || ticker).toUpperCase()}
              </button>
              {data.url && (
                <button onClick={() => window.open(data.url!, "_blank")}
                  className="h-8 w-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors shrink-0"
                  title="View chart">
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
              )}
              {data.websites && data.websites.length > 0 && (
                <button onClick={() => window.open(data.websites![0].url, "_blank")}
                  className="h-8 w-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors shrink-0"
                  title="Website">
                  <Globe className="h-3.5 w-3.5" />
                </button>
              )}
              {data.socials && data.socials.map((s, i) => {
                const isX = s.type === "twitter" || s.url.includes("twitter.com") || s.url.includes("x.com");
                const isTg = s.type === "telegram" || s.url.includes("t.me");
                return (
                  <button key={i} onClick={() => window.open(s.url, "_blank")}
                    className="h-8 w-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors shrink-0"
                    title={isX ? "X / Twitter" : isTg ? "Telegram" : "Social"}>
                    {isX ? (
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                      </svg>
                    ) : isTg ? (
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                      </svg>
                    ) : (
                      <Globe className="h-3.5 w-3.5" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* ── Duplicate warning — hanya untuk $TICKER, bukan CA ── */}
            {allTokens.length > 1 && !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(ticker) && (
              <div>
                <button
                  onClick={() => setShowDuplicates(!showDuplicates)}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-warning/10 border border-warning/30 text-[10px] font-semibold text-warning hover:bg-warning/20 transition-colors"
                >
                  <span>⚠️ {allTokens.length} tokens with ticker ${ticker.toUpperCase()} found</span>
                  <span>{showDuplicates ? "▲" : "▼"}</span>
                </button>

                {showDuplicates && (
                  <div className="mt-1.5 space-y-1 max-h-40 overflow-y-auto">
                    {allTokens.map((t, i) => {
                      const { isLegit } = checkTokenLegit(t);
                      const isCurrent = t.tokenAddress === data.tokenAddress;
                      return (
                        <button
                          key={t.tokenAddress}
                          onClick={() => { setData(t); setShowDuplicates(false); }}
                          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-left transition-colors ${
                            isCurrent
                              ? "bg-primary/10 border-primary/30"
                              : "bg-muted/20 border-border hover:bg-muted/40"
                          }`}
                        >
                          <span className="text-[10px] text-muted-foreground shrink-0">#{i + 1}</span>
                          {t.icon && (
                            <img src={t.icon} alt="" className="h-4 w-4 rounded-full object-cover shrink-0"
                              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                          )}
                          <div className="flex-1 min-w-0">
                            <span className="text-[11px] font-semibold text-foreground truncate block">{t.name}</span>
                            <span className="text-[9px] text-muted-foreground font-mono">{truncateAddress(t.tokenAddress)}</span>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-[10px] font-mono text-foreground block">{formatPrice(t.priceUsd)}</span>
                            <span className="text-[9px] text-muted-foreground">{formatLarge(t.liquidity)} liq</span>
                          </div>
                          {!isLegit && <span className="text-[10px] shrink-0">⚠️</span>}
                          {isCurrent && <span className="text-[10px] text-primary shrink-0">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}

// ── TokenAddressChip ─────────────────────────────────────────────────────────
// Komponen kecil untuk menampilkan detail token dari CA yang diposting

function TokenAddressChip({ address }: { address: string }) {
  const navigate = useNavigate();
  const [data, setData] = useState<TokenHoverData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoverState, setHoverState] = useState<{ rect: DOMRect } | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: res } = await supabase.functions.invoke("search-tokens", {
          body: { query: address },
        });
        if (!cancelled && res?.success && res.tokens?.length > 0) {
          setData(res.tokens[0]);
        }
      } catch {}
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [address]);

  const showPopup = useCallback((e: React.MouseEvent) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setHoverState({ rect });
  }, []);

  const scheduleHide = useCallback(() => {
    hideTimer.current = setTimeout(() => setHoverState(null), 300);
  }, []);

  const cancelHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  const handleNavigate = useCallback((addr: string) => {
    setHoverState(null);
    navigate(`/market?token=${addr}`);
  }, [navigate]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/market?token=${address}`);
  };

  const chipLabel = loading
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : data
      ? data.symbol ? `$${data.symbol}` : data.name
      : `${address.slice(0, 6)}...${address.slice(-4)}`;

  const legitResult = data ? checkTokenLegit(data) : null;
  const isScam = legitResult && !legitResult.isLegit;

  return (
    <>
      <span
        onMouseEnter={showPopup}
        onMouseLeave={scheduleHide}
        onClick={handleClick}
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-semibold cursor-pointer transition-colors mx-0.5 select-none ${
          loading
            ? "bg-muted/60 border-border text-muted-foreground"
            : isScam
              ? "bg-destructive/10 border-destructive/30 text-destructive hover:bg-destructive/20"
              : data
                ? "bg-primary/10 border-primary/20 text-primary hover:bg-primary/20"
                : "bg-muted/60 border-border text-muted-foreground hover:border-primary/40"
        }`}
      >
        {loading && <Loader2 className="h-3 w-3 animate-spin" />}
        {!loading && isScam && <span className="text-[10px]">⚠️</span>}
        {!loading && !isScam && data?.icon && (
          <img src={data.icon} alt="" className="h-3.5 w-3.5 rounded-full object-cover"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
        )}
        {chipLabel}
        {!loading && !isScam && data?.priceUsd && (
          <span className="text-[10px] font-mono text-muted-foreground">
            {formatPrice(data.priceUsd)}
          </span>
        )}
      </span>

      <AnimatePresence>
        {hoverState && (
          <TokenHoverCard
            ticker={address}
            anchorRect={hoverState.rect}
            onClose={() => { cancelHide(); setHoverState(null); }}
            onNavigate={handleNavigate}
            onCancelHide={cancelHide}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ── MentionChip ───────────────────────────────────────────────────────────────
function MentionChip({ username }: { username: string }) {
  const navigate = useNavigate();
  const [avatar, setAvatar] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("avatar_url")
      .eq("username", username)
      .single()
      .then(({ data }) => { if (data?.avatar_url) setAvatar(data.avatar_url); });
  }, [username]);

  return (
    <span
      onClick={(e) => { e.stopPropagation(); navigate(`/profile/${username}`); }}
      className="inline-flex items-center gap-1 text-primary font-semibold cursor-pointer hover:underline underline-offset-2 decoration-primary/50 transition-colors"
    >
      {avatar ? (
        <img src={avatar} alt="" className="h-4 w-4 rounded-full object-cover inline-block" />
      ) : (
        <span className="h-4 w-4 rounded-full bg-primary/20 inline-flex items-center justify-center text-[8px] font-bold text-primary">
          {username[0]?.toUpperCase()}
        </span>
      )}
      @{username}
    </span>
  );
}

// ── PostContent ───────────────────────────────────────────────────────────────
// Renders post text. $TICKER (all-caps 1–10 chars) becomes a hoverable + clickable link.
// Solana CA (base58, 32-44 chars) menjadi token chip dengan detail otomatis.
// Hover → show TokenHoverCard popup
// Click → navigate to /market?token=TICKER

interface PostContentProps {
  content: string;
}

// Regex untuk Solana address: base58, panjang 32-44 karakter
const SOLANA_ADDRESS_REGEX = /\b([1-9A-HJ-NP-Za-km-z]{32,44})\b/g;

export function PostContent({ content }: PostContentProps) {
  const navigate = useNavigate();
  const [hoverState, setHoverState] = useState<{ ticker: string; rect: DOMRect } | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Split berdasarkan URL, $TICKER, Solana address, #hashtag, dan @mention
  const parts = content.split(/(https?:\/\/[^\s]+|\$[A-Z]{1,10}(?![A-Za-z])|\b[1-9A-HJ-NP-Za-km-z]{32,44}\b|#[a-zA-Z0-9_]{1,30}|@[a-zA-Z0-9_]{1,30})/g);

  const showPopup = useCallback((ticker: string, e: React.MouseEvent) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setHoverState({ ticker: ticker.replace(/^\$/, ""), rect });
  }, []);

  const scheduleHide = useCallback(() => {
    hideTimer.current = setTimeout(() => setHoverState(null), 300);
  }, []);

  const cancelHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  const handleNavigate = useCallback((address: string) => {
    setHoverState(null);
    navigate(`/market?token=${address}`);
  }, [navigate]);

  return (
    <>
      <p className="text-sm text-foreground leading-relaxed mt-1 whitespace-pre-wrap break-words">
        {parts.map((part, i) => {
          // URL — clickable link
          if (/^https?:\/\/[^\s]+$/.test(part)) {
            return (
              <a
                key={i}
                href={part}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-info hover:underline underline-offset-2 break-all transition-colors"
              >
                {part}
              </a>
            );
          }
          // $TICKER — hover popup + klik ke market
          if (/^\$[A-Z]{1,10}$/.test(part)) {
            const ticker = part.slice(1);
            return (
              <span
                key={i}
                className="text-primary font-semibold cursor-pointer hover:underline underline-offset-2 decoration-primary/50 transition-colors select-none"
                onMouseEnter={(e) => showPopup(ticker, e)}
                onMouseLeave={scheduleHide}
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/market?token=${encodeURIComponent(ticker)}`);
                }}
              >
                {part}
              </span>
            );
          }
          // Solana address — tampilkan sebagai token chip dengan detail
          if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(part)) {
            return <TokenAddressChip key={i} address={part} />;
          }
          // #hashtag — warna unik
          if (/^#[a-zA-Z0-9_]{1,30}$/.test(part)) {
            return (
              <span key={i} className="text-info font-semibold cursor-pointer hover:underline underline-offset-2 decoration-info/50 transition-colors"
                onClick={(e) => e.stopPropagation()}>
                {part}
              </span>
            );
          }
          // @mention — tampilkan dengan avatar inline
          if (/^@[a-zA-Z0-9_]{1,30}$/.test(part)) {
            return <MentionChip key={i} username={part.slice(1)} />;
          }
          return <span key={i}>{part}</span>;
        })}
      </p>

      <AnimatePresence>
        {hoverState && (
          <TokenHoverCard
            ticker={hoverState.ticker}
            anchorRect={hoverState.rect}
            onClose={() => { cancelHide(); setHoverState(null); }}
            onNavigate={handleNavigate}
            onCancelHide={cancelHide}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

interface PostCardProps {
  post: Post;
  onUpdate: (postId: string, updates: Partial<Post>) => void;
  onDelete: (postId: string) => void;
  index: number;
}

export default function PostCard({ post, onUpdate, onDelete, index }: PostCardProps) {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const [showComments, setShowComments] = useState(false);
  const [liking, setLiking] = useState(false);
  const [reposting, setReposting] = useState(false);
  const [showTipModal, setShowTipModal] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // View tracking refs
  const cardRef = useRef<HTMLDivElement>(null);
  const didTrack = useRef(false);

  const isRepost = post.post_type === "repost" && !!post.parent_post;
  const isQuote = post.post_type === "quote" && !!post.parent_post;
  const isOrphanRepost = post.post_type === "repost" && !post.parent_post;
  const displayPost = isRepost ? post.parent_post! : post;

  const isOwn = profile?.id === post.user_id;
  const displayName = isOrphanRepost ? "Unknown" : (displayPost.author?.display_name || displayPost.author?.username || "Anonymous");
  const username = isOrphanRepost ? "" : (displayPost.author?.username ? `@${displayPost.author.username}` : "");
  const contentLong = !isRepost && !isOrphanRepost && displayPost.content.length > 200;
  const repostAuthorName = post.author?.display_name || post.author?.username || "Someone";

  const targetPostId = isRepost ? post.parent_post!.id : post.id;

  // IntersectionObserver-based view tracking with deduplication
  useEffect(() => {
    if (isOrphanRepost) return;
    const cacheKey = `vw_${displayPost.id}`;
    if (sessionStorage.getItem(cacheKey)) return;

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || didTrack.current) return;
        didTrack.current = true;
        sessionStorage.setItem(cacheKey, "1");
        obs.disconnect();

        supabase.rpc("increment_post_view" as any, {
          p_post_id: displayPost.id,
          p_viewer_id: profile?.id ?? null,
          p_session_id: profile?.id ? null : getSessionId(),
        }).then(() => {
          onUpdate(displayPost.id, { views_count: displayPost.views_count + 1 });
        });
      },
      { threshold: 0.6 }
    );

    if (cardRef.current) obs.observe(cardRef.current);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayPost.id, isOrphanRepost]);

  if (isOrphanRepost) return null;

  const handleLike = async () => {
    if (!profile) return toast.error("Connect wallet first");
    if (liking) return;
    setLiking(true);
    try {
      const nowLiked = await feedAPI.toggleLike(targetPostId, profile.id, !!displayPost.is_liked);
      onUpdate(targetPostId, {
        is_liked: nowLiked,
        likes_count: nowLiked ? displayPost.likes_count + 1 : Math.max(0, displayPost.likes_count - 1),
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLiking(false);
    }
  };

  const handleRepost = async () => {
    if (!profile) return toast.error("Connect wallet first");
    if (reposting) return;
    setReposting(true);
    try {
      const result = await feedAPI.createRepost(targetPostId, profile.id);
      onUpdate(targetPostId, {
        is_reposted: result.reposted,
        reposts_count: result.reposted ? (displayPost.reposts_count || 0) + 1 : Math.max(0, (displayPost.reposts_count || 0) - 1),
      });
      toast.success(result.reposted ? "Reposted!" : "Repost removed");
    } catch (err) {
      console.error(err);
      toast.error("Failed to repost");
    } finally {
      setReposting(false);
    }
  };

  const handleQuote = async (quoteContent: string): Promise<void> => {
    if (!profile) {
      toast.error("Connect wallet first");
      return;
    }
    await feedAPI.createQuote(targetPostId, profile.id, quoteContent);
    onUpdate(targetPostId, { reposts_count: (displayPost.reposts_count || 0) + 1 });
    toast.success("Quote posted!");
  };

  const handleDelete = async () => {
    try {
      await feedAPI.deletePost(post.id);
      onDelete(post.id);
      toast.success("Post deleted");
    } catch {
      toast.error("Failed to delete post");
    }
  };

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/post/${targetPostId}`;
    await navigator.clipboard.writeText(url);
    await feedAPI.incrementShares(targetPostId);
    toast.success("Link copied!");
    onUpdate(targetPostId, { shares_count: displayPost.shares_count + 1 });
  };

  const handleShareToX = async () => {
    const postUrl = `${window.location.origin}/post/${targetPostId}`;
    const text = encodeURIComponent("Check out this post on xbags.social! 🎒");
    const url = encodeURIComponent(postUrl);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, "_blank");
    await feedAPI.incrementShares(targetPostId);
    onUpdate(targetPostId, { shares_count: displayPost.shares_count + 1 });
  };

  return (
    <>
      <motion.div
        ref={cardRef}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.03, duration: 0.3 }}
        className="px-4 py-4 hover:bg-muted/30 transition-colors border-b border-border cursor-pointer"
      >
        {isRepost && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2 ml-12">
            <Repeat2 className="h-3.5 w-3.5" />
            <span>{repostAuthorName} reposted</span>
          </div>
        )}

        <div className="flex gap-3">
          <Avatar
            className="h-10 w-10 shrink-0 ring-2 ring-transparent hover:ring-primary/30 transition-all cursor-pointer"
            onClick={() => displayPost.author?.username && navigate(`/profile/${displayPost.author.username}`)}
          >
            <AvatarImage src={displayPost.author?.avatar_url || undefined} />
            <AvatarFallback className="bg-primary/20 text-primary text-sm font-bold">
              {displayName[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-semibold text-sm text-foreground truncate">{displayName}</span>
                <span className="text-sm text-muted-foreground truncate">{username}</span>
                <span className="text-xs text-muted-foreground" title={formatDate(displayPost.created_at)}>· {timeAgo(displayPost.created_at)}</span>
              </div>
              {isOwn && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                      <Trash2 className="h-4 w-4 mr-2" /> Delete Post
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            <div onClick={() => navigate(`/post/${targetPostId}`)} className="cursor-pointer">
              {isQuote ? (
                <PostContent
                  content={contentLong && !expanded ? `${post.content.slice(0, 200)}...` : post.content}
                />
              ) : (
                <PostContent
                  content={contentLong && !expanded ? `${displayPost.content.slice(0, 200)}...` : displayPost.content}
                />
              )}
              {contentLong && (
                <button onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }} className="text-xs text-primary mt-1 hover:underline">
                  {expanded ? "Show less" : "Show more"}
                </button>
              )}
            </div>

            {isQuote && post.parent_post && <EmbeddedPost post={post.parent_post} />}

            <p className="text-[11px] text-muted-foreground mt-1.5">{formatDate(displayPost.created_at)}</p>

            {displayPost.media_urls && displayPost.media_urls.length > 0 && (
              <div className="mt-2 rounded-xl overflow-hidden border border-border">
                {displayPost.media_type === "video" ? (
                  <video src={displayPost.media_urls[0]} controls className="w-full max-h-80 object-cover" />
                ) : (
                  <div className={`grid gap-0.5 ${displayPost.media_urls.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                    {displayPost.media_urls.map((url, i) => (
                      <img key={i} src={url} alt="" className="w-full max-h-80 object-cover" loading="lazy" />
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-1">
                {/* Comment */}
                <button onClick={() => setShowComments(!showComments)} className="flex items-center gap-1.5 h-8 px-2 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors text-xs">
                  <MessageCircle className="h-4 w-4" />
                  <span>{formatCount(displayPost.comments_count)}</span>
                </button>

                {/* Repost */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button disabled={reposting} className={`flex items-center gap-1.5 h-8 px-2 rounded-full transition-colors text-xs ${displayPost.is_reposted ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-primary hover:bg-primary/10"}`}>
                      <Repeat2 className="h-4 w-4" />
                      <span>{formatCount(displayPost.reposts_count || 0)}</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-[160px]">
                    <DropdownMenuItem onClick={handleRepost}><Repeat2 className="h-4 w-4 mr-2" />{displayPost.is_reposted ? "Undo Repost" : "Repost"}</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setShowQuoteModal(true)}><MessageCircle className="h-4 w-4 mr-2" />Quote Tweet</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Like */}
                <motion.button onClick={handleLike} disabled={liking} className={`flex items-center gap-1.5 h-8 px-2 rounded-full transition-colors text-xs ${displayPost.is_liked ? "text-destructive bg-destructive/10" : "text-muted-foreground hover:text-destructive hover:bg-destructive/10"}`} whileTap={{ scale: 1.15 }} transition={{ type: "spring", stiffness: 400, damping: 10 }}>
                  <Heart className={`h-4 w-4 ${displayPost.is_liked ? "fill-current" : ""}`} />
                  <AnimatePresence mode="wait">
                    <motion.span key={displayPost.likes_count} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 6, opacity: 0 }} transition={{ duration: 0.12 }}>
                      {formatCount(displayPost.likes_count)}
                    </motion.span>
                  </AnimatePresence>
                </motion.button>

                {/* Tip */}
                {!isOwn && displayPost.author?.wallet_address && (
                  <button onClick={() => setShowTipModal(true)} className="flex items-center gap-1.5 h-8 px-2 rounded-full text-muted-foreground hover:text-warning hover:bg-warning/10 transition-colors text-xs">
                    <Diamond className="h-4 w-4" />
                  </button>
                )}

                {/* Share */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-1.5 h-8 px-2 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors text-xs">
                      <Share2 className="h-4 w-4" />
                      <span>{formatCount(displayPost.shares_count)}</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-[160px]">
                    <DropdownMenuItem onClick={handleShareToX}><ExternalLink className="h-4 w-4 mr-2" />Share to X</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleCopyLink}><Link2 className="h-4 w-4 mr-2" />Copy Link</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <span className="flex items-center gap-1 text-xs text-muted-foreground pr-1">
                <Eye className="h-3 w-3" />
                <AnimatePresence mode="wait">
                  <motion.span key={displayPost.views_count} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
                    {formatCount(displayPost.views_count)}
                  </motion.span>
                </AnimatePresence>
              </span>
            </div>

            <AnimatePresence>
              {showComments && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                  <CommentSection
                    postId={targetPostId}
                    onCommentAdded={() => onUpdate(targetPostId, { comments_count: displayPost.comments_count + 1 })}
                    onCommentDeleted={() => onUpdate(targetPostId, { comments_count: Math.max(0, displayPost.comments_count - 1) })}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {showTipModal && displayPost.author && (
        <TipModal isOpen={showTipModal} onClose={() => setShowTipModal(false)} recipientWallet={displayPost.author.wallet_address} recipientName={displayName} recipientUsername={displayPost.author.username} />
      )}

      {showQuoteModal && (
        <QuoteModal isOpen={showQuoteModal} onClose={() => setShowQuoteModal(false)} onQuote={handleQuote} originalPost={{ content: displayPost.content, author: displayPost.author }} />
      )}
    </>
  );
}