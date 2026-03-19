import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, TrendingDown, Loader2, ExternalLink, X } from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────

interface TokenStats {
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
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatPrice(p: string | null): string {
  if (!p) return "—";
  const n = parseFloat(p);
  if (isNaN(n) || n === 0) return "$0";
  if (n >= 1_000) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(5)}`;
  const fixed = n.toFixed(12);
  const match = fixed.match(/^0\.(0*)([1-9]\d{0,3})/);
  if (match) {
    const zeros = match[1].length;
    const sig = match[2];
    return `$0.0${zeros > 0 ? `\u208${Math.min(zeros, 9)}` : ""}${sig}`;
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

function PctChange({ value, label }: { value: number | null | undefined; label: string }) {
  if (value === null || value === undefined) {
    return (
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-[10px] text-muted-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">—</span>
      </div>
    );
  }
  const pos = value >= 0;
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className={`text-xs font-semibold flex items-center gap-0.5 ${pos ? "text-success" : "text-destructive"}`}>
        {pos ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
        {Math.abs(value).toFixed(2)}%
      </span>
    </div>
  );
}

// ─── Mini Popup ────────────────────────────────────────────────────────────

interface TokenPopupProps {
  ticker: string;
  anchorRect: DOMRect;
  onClose: () => void;
  onNavigate: (address: string) => void;
}

function TokenPopup({ ticker, anchorRect, onClose, onNavigate }: TokenPopupProps) {
  const [stats, setStats] = useState<TokenStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  // ── Position calculation
  const [pos, setPos] = useState({ top: 0, left: 0, above: false });

  useEffect(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const popupH = 220;
    const popupW = Math.min(280, vw - 24);

    let left = anchorRect.left;
    if (left + popupW > vw - 12) left = vw - popupW - 12;
    if (left < 12) left = 12;

    const spaceBelow = vh - anchorRect.bottom;
    const above = spaceBelow < popupH + 12;
    const top = above
      ? anchorRect.top - popupH - 6
      : anchorRect.bottom + 6;

    setPos({ top, left, above });
  }, [anchorRect]);

  // ── Fetch token data
  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      try {
        const { data } = await supabase.functions.invoke("search-tokens", {
          body: { query: ticker },
        });
        if (cancelled) return;
        if (data?.success && data.tokens?.length > 0) {
          setStats(data.tokens[0]);
        } else {
          setError(true);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetch();
    return () => { cancelled = true; };
  }, [ticker]);

  // ── Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // slight delay so the long-press release doesn't immediately close
    const t = setTimeout(() => document.addEventListener("mousedown", handler), 100);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", handler);
    };
  }, [onClose]);

  return (
    <motion.div
      ref={popupRef}
      initial={{ opacity: 0, scale: 0.92, y: pos.above ? 6 : -6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: pos.above ? 6 : -6 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        width: Math.min(280, window.innerWidth - 24),
        zIndex: 9999,
      }}
      className="bg-card border border-border rounded-xl shadow-modal overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          {stats?.icon && (
            <img src={stats.icon} alt="" className="h-5 w-5 rounded-full object-cover" />
          )}
          <span className="text-sm font-bold text-foreground">
            ${ticker.toUpperCase()}
          </span>
          {stats && (
            <span className="text-xs text-muted-foreground truncate max-w-[100px]">
              {stats.name}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Body */}
      <div className="p-3">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : error || !stats ? (
          <div className="text-center py-4">
            <p className="text-xs text-muted-foreground">Token data not found</p>
            <p className="text-[10px] text-muted-foreground mt-1">${ticker.toUpperCase()} may not be listed yet</p>
          </div>
        ) : (
          <>
            {/* Price */}
            <div className="flex items-end justify-between mb-3">
              <div>
                <p className="text-[10px] text-muted-foreground mb-0.5">Current Price</p>
                <p className="text-lg font-bold text-foreground font-mono">
                  {formatPrice(stats.priceUsd)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground mb-0.5">Market Cap</p>
                <p className="text-sm font-semibold text-foreground">{formatMcap(stats.marketCap)}</p>
              </div>
            </div>

            {/* Price change grid */}
            <div className="grid grid-cols-4 gap-1 mb-3 p-2 rounded-lg bg-muted/30">
              <PctChange value={stats.priceChange?.m5} label="5m" />
              <PctChange value={stats.priceChange?.h1} label="1h" />
              <PctChange value={stats.priceChange?.h6} label="6h" />
              <PctChange value={stats.priceChange?.h24} label="24h" />
            </div>

            {/* FDV / Vol / Liq */}
            <div className="grid grid-cols-3 gap-1 mb-3">
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground">FDV</p>
                <p className="text-xs font-medium text-foreground">{formatMcap(stats.fdv)}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground">Vol 24h</p>
                <p className="text-xs font-medium text-foreground">{formatMcap(stats.volume24h)}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground">Liquidity</p>
                <p className="text-xs font-medium text-foreground">{formatMcap(stats.liquidity)}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => onNavigate(stats.tokenAddress)}
                className="flex-1 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-secondary transition-colors"
              >
                Trade
              </button>
              {stats.url && (
                <button
                  onClick={() => window.open(stats.url!, "_blank")}
                  className="h-7 w-7 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}

// ─── Main: parse content and render token links ────────────────────────────

interface PostContentProps {
  content: string;
}

/**
 * Renders post content with $TICKER mentions as clickable links.
 * Click → navigate to /market?token=TICKER
 * Long press (500ms) → show mini popup with token stats
 */
export function PostContent({ content }: PostContentProps) {
  const navigate = useNavigate();
  const [popup, setPopup] = useState<{
    ticker: string;
    rect: DOMRect;
  } | null>(null);

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);

  // Split content into text segments and $TICKER mentions
  const parts = content.split(/(\$[A-Z]{1,10}(?![a-z]))/g);

  const handleClick = useCallback(
    (ticker: string) => {
      if (longPressTriggered.current) return;
      navigate(`/market?token=${encodeURIComponent(ticker)}`);
    },
    [navigate]
  );

  const handleLongPress = useCallback(
    (ticker: string, e: React.TouchEvent | React.MouseEvent) => {
      // Get the bounding rect of the target element
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      longPressTriggered.current = true;
      setPopup({ ticker: ticker.replace(/^\$/, ""), rect });
    },
    []
  );

  const startLongPress = useCallback(
    (ticker: string, e: React.TouchEvent | React.MouseEvent) => {
      longPressTriggered.current = false;
      longPressTimer.current = setTimeout(() => handleLongPress(ticker, e), 500);
    },
    [handleLongPress]
  );

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleNavigate = useCallback(
    (address: string) => {
      setPopup(null);
      navigate(`/market?token=${address}`);
    },
    [navigate]
  );

  return (
    <>
      <p className="text-sm text-foreground leading-relaxed mt-1 whitespace-pre-wrap break-words">
        {parts.map((part, i) => {
          // Check if this part is a $TICKER mention
          if (/^\$[A-Z]{1,10}$/.test(part)) {
            const ticker = part.slice(1); // remove $
            return (
              <span
                key={i}
                className="text-primary font-semibold cursor-pointer hover:underline hover:text-primary/80 transition-colors select-none"
                onClick={() => handleClick(ticker)}
                onMouseDown={(e) => startLongPress(ticker, e)}
                onMouseUp={cancelLongPress}
                onMouseLeave={cancelLongPress}
                onTouchStart={(e) => startLongPress(ticker, e)}
                onTouchEnd={cancelLongPress}
                onTouchMove={cancelLongPress}
                title={`Click to trade $${ticker} • Hold for quick stats`}
              >
                {part}
              </span>
            );
          }
          return <span key={i}>{part}</span>;
        })}
      </p>

      {/* Token stats popup */}
      <AnimatePresence>
        {popup && (
          <TokenPopup
            ticker={popup.ticker}
            anchorRect={popup.rect}
            onClose={() => setPopup(null)}
            onNavigate={handleNavigate}
          />
        )}
      </AnimatePresence>
    </>
  );
}