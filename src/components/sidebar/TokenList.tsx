import { ArrowUpRight, ArrowDownRight, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface Token {
  tokenAddress: string;
  icon: string | null;
  name: string;
  symbol: string | null;
  priceUsd: string | null;
  priceChange24h: number | null;
  volume24h: number | null;
  marketCap: number | null;
  url: string;
  createdAt?: number | null;
}

const formatPrice = (price: string | null) => {
  if (!price) return "-";
  const num = parseFloat(price);
  if (isNaN(num)) return "-";
  if (num === 0) return "$0";
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(2)}K`;
  if (num >= 1) return `$${num.toFixed(2)}`;
  if (num >= 0.01) return `$${num.toFixed(4)}`;
  if (num >= 0.0001) return `$${num.toFixed(6)}`;
  // Subscript zero notation for very small prices: $0.0₍5₎1234
  const str = num.toFixed(20);
  const match = str.match(/^0\.(0+)(\d{4})/);
  if (match) {
    const zeroCount = match[1].length;
    const significantDigits = match[2];
    return `$0.0₍${zeroCount}₎${significantDigits}`;
  }
  return `$${num.toExponential(2)}`;
};

const formatMarketCap = (mc: number | null) => {
  if (!mc) return "-";
  if (mc >= 1_000_000_000) return `$${(mc / 1_000_000_000).toFixed(2)}B`;
  if (mc >= 1_000_000) return `$${(mc / 1_000_000).toFixed(2)}M`;
  if (mc >= 1_000) return `$${(mc / 1_000).toFixed(1)}K`;
  return `$${mc.toFixed(0)}`;
};

const formatTimeAgo = (timestamp: number | null) => {
  if (!timestamp) return "";
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const TokenSkeleton = () => (
  <div className="flex items-center gap-3 py-1.5">
    <Skeleton className="h-9 w-9 rounded-full shrink-0" />
    <div className="flex-1 min-w-0 space-y-1.5">
      <Skeleton className="h-3.5 w-20" />
      <Skeleton className="h-3 w-14" />
    </div>
    <div className="space-y-1.5 text-right">
      <Skeleton className="h-3.5 w-12 ml-auto" />
      <Skeleton className="h-3 w-10 ml-auto" />
    </div>
    <Skeleton className="h-7 w-12 rounded-md" />
  </div>
);

interface TokenListProps {
  tokens: Token[];
  loading: boolean;
  emptyMessage: string;
  showTimeAgo?: boolean;
  onBuy: (token: Token) => void;
}

const TokenList = ({ tokens, loading, emptyMessage, showTimeAgo, onBuy }: TokenListProps) => {
  if (loading) {
    return (
      <div className="space-y-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <TokenSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (tokens.length === 0) {
    return <p className="text-xs text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-1">
      {tokens.map((token) => (
        <div
          key={token.tokenAddress}
          className="flex items-center gap-2.5 hover:bg-muted/50 -mx-2 px-2 py-1.5 rounded-lg transition-colors group"
        >
          <a
            href={token.url}
            target="_blank"
            rel="noopener noreferrer"
            className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden"
          >
            {token.icon ? (
              <img src={token.icon} alt={token.symbol || ''} className="h-9 w-9 rounded-full object-cover" />
            ) : (
              <span className="text-xs font-bold text-primary">
                {token.symbol?.slice(0, 2) || '?'}
              </span>
            )}
          </a>

          <a
            href={token.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 min-w-0"
          >
            <div className="flex items-center gap-1">
              <span className="text-sm font-semibold text-foreground truncate">{token.symbol || token.name}</span>
              {token.priceChange24h !== null && (
                <span className={`text-[10px] flex items-center gap-0.5 ${token.priceChange24h >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                  {token.priceChange24h >= 0 ? (
                    <ArrowUpRight className="h-2.5 w-2.5" />
                  ) : (
                    <ArrowDownRight className="h-2.5 w-2.5" />
                  )}
                  {Math.abs(token.priceChange24h).toFixed(1)}%
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {token.name}
              {showTimeAgo && token.createdAt && <span className="ml-1">· {formatTimeAgo(token.createdAt)}</span>}
            </p>
          </a>

          <div className="text-right shrink-0">
            <div className="text-sm font-semibold text-foreground">{formatPrice(token.priceUsd)}</div>
            <div className="text-[10px] text-muted-foreground">MC {formatMarketCap(token.marketCap)}</div>
          </div>

          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-[10px] border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground rounded-md shrink-0 opacity-70 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onBuy(token);
            }}
          >
            <ShoppingCart className="h-3 w-3 mr-0.5" />
            Buy
          </Button>
        </div>
      ))}
    </div>
  );
};

export default TokenList;
