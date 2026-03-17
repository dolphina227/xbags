import { useState, useEffect, useCallback, useRef } from "react";
import { Search, UserPlus, ArrowRightLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/hooks/use-wallet";
import { useConnection } from "@solana/wallet-adapter-react";
import { useWallet as useSolanaWallet } from "@solana/wallet-adapter-react";
import { VersionedTransaction, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { useToast } from "@/hooks/use-toast";
import { parseRpcError, getRpcUrl } from "@/lib/solana-utils";
import { useNavigate } from "react-router-dom";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const PRESET_AMOUNTS = [0.1, 0.5, 1, 2];

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

const RightSidebar = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

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
      // Search users in parallel with token search
      const [userRes, tokenRes] = await Promise.all([
        // User search
        supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url, created_at")
          .or(`username.ilike.%${cleanQ}%,display_name.ilike.%${cleanQ}%`)
          .limit(5),
        // Token search via edge function
        supabase.functions.invoke("search-tokens", {
          body: { query: cleanQ },
        }),
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
    // Navigate to market page with token address as param
    navigate(`/market?token=${token.tokenAddress}`);
    setSearchQuery("");
    setTokenResults([]);
    setSearchResults([]);
  };

  // ── New Users (Who to Follow) ──────────
  const [newUsers, setNewUsers] = useState<Profile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  useEffect(() => {
    const fetchNewUsers = async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url, created_at")
          .order("created_at", { ascending: false })
          .limit(5);
        setNewUsers(data || []);
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

  // ── Quick Swap ─────────────────────────
  const [swapMode, setSwapMode] = useState<"buy" | "sell">("buy");
  const [tokenMint, setTokenMint] = useState("");
  const [solAmount, setSolAmount] = useState("0.1");
  const [swapStep, setSwapStep] = useState<"idle" | "quoting" | "quoted" | "signing" | "sending" | "confirming" | "done" | "error">("idle");
  const [quoteData, setQuoteData] = useState<any>(null);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [estimateText, setEstimateText] = useState("");

  const { address: walletAddress, refreshBalance } = useWallet();
  const { connection } = useConnection();
  const { signTransaction } = useSolanaWallet();
  const swapLoading = ["quoting", "signing", "sending", "confirming"].includes(swapStep);

  const handleGetQuote = async () => {
    if (!tokenMint.trim() || !solAmount) return;
    setSwapStep("quoting");
    setSwapError(null);
    setQuoteData(null);
    setEstimateText("");
    try {
      const amountLamports = Math.floor(parseFloat(solAmount) * 1_000_000_000);
      const inputMint = swapMode === "buy" ? SOL_MINT : tokenMint.trim();
      const outputMint = swapMode === "buy" ? tokenMint.trim() : SOL_MINT;
      const { data, error } = await supabase.functions.invoke("bags-trade", {
        body: { action: "quote", inputMint, outputMint, amount: amountLamports, slippageMode: "auto" },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Quote failed");
      setQuoteData(data.response);
      const outAmt = parseInt(data.response.outAmount) / 1_000_000_000;
      setEstimateText(`≈ ${outAmt >= 1000 ? outAmt.toLocaleString("en-US", { maximumFractionDigits: 2 }) : outAmt.toFixed(4)}`);
      setSwapStep("quoted");
    } catch (err: any) {
      setSwapError(err.message || "Quote failed");
      setSwapStep("error");
    }
  };

  const handleSwap = async () => {
    if (!quoteData || !walletAddress || !signTransaction) return;
    try {
      const { Connection } = await import("@solana/web3.js");
      const conn = new Connection(getRpcUrl(), "confirmed");
      const balance = await conn.getBalance(new PublicKey(walletAddress));
      if (balance / 1_000_000_000 < parseFloat(solAmount) + 0.003) throw new Error("Insufficient funds");
      setSwapStep("signing");
      setSwapError(null);
      const { data, error } = await supabase.functions.invoke("bags-trade", {
        body: { action: "swap", quoteResponse: quoteData, userPublicKey: walletAddress },
      });
      if (error) throw new Error(error.message);
      const swapTx = data?.swapTransaction || data?.response?.swapTransaction;
      if (!swapTx) throw new Error("No swap transaction returned");
      const txBytes = bs58.decode(swapTx);
      const transaction = VersionedTransaction.deserialize(txBytes);
      const signedTx = await signTransaction(transaction);
      setSwapStep("sending");
      const rawTx = signedTx.serialize();
      const signature = await connection.sendRawTransaction(rawTx, { skipPreflight: false, maxRetries: 3 });
      setSwapStep("confirming");
      const bh = await connection.getLatestBlockhash();
      await connection.confirmTransaction({ signature, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight }, "confirmed");
      setSwapStep("done");
      toast({ title: "Swap successful! 🎉", description: `Swapped ${solAmount} SOL` });
      setTimeout(refreshBalance, 2000);
      setTimeout(() => setSwapStep("idle"), 3000);
    } catch (err: any) {
      const parsed = parseRpcError(err);
      setSwapError(parsed.message);
      setSwapStep("error");
    }
  };

  const getInitials = (p: Profile) => {
    const name = p.display_name || p.username || "?";
    return name.slice(0, 2).toUpperCase();
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
          {/* Search Results Dropdown */}
          {searchQuery.trim() && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
              {searching ? (
                <div className="p-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Searching...
                </div>
              ) : (
                <>
                  {/* Token results */}
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

                  {/* User results */}
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

        {/* ── Who to Follow ────────────── */}
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
                      @{user.username || "user"}
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

        {/* ── Quick Swap ───────────────── */}
        <div className="rounded-xl bg-card border border-border p-4">
          <div className="flex items-center gap-2 mb-3">
            <ArrowRightLeft className="h-4 w-4 text-primary" />
            <h3 className="font-bold text-sm text-foreground">QUICK SWAP in repair</h3>
          </div>

          <div className="flex gap-1 mb-3 bg-muted/30 rounded-lg p-1">
            <button
              onClick={() => setSwapMode("buy")}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                swapMode === "buy" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >Buy</button>
            <button
              onClick={() => setSwapMode("sell")}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                swapMode === "sell" ? "bg-destructive text-destructive-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >Sell</button>
          </div>

          <div className="space-y-2 mb-3">
            <label className="text-xs font-medium text-muted-foreground">Token mint address</label>
            <Input
              value={tokenMint}
              onChange={(e) => { setTokenMint(e.target.value); setSwapStep("idle"); setQuoteData(null); }}
              placeholder="Paste token address..."
              className="bg-background border-border text-xs h-9"
              disabled={swapLoading}
            />
          </div>

          <div className="space-y-2 mb-3">
            <label className="text-xs font-medium text-muted-foreground">Amount (SOL)</label>
            <Input
              type="number"
              value={solAmount}
              onChange={(e) => { setSolAmount(e.target.value); setSwapStep("idle"); setQuoteData(null); }}
              placeholder="0.00"
              className="bg-background border-border text-xs h-9"
              step="0.1" min="0.01"
              disabled={swapLoading}
            />
            <div className="flex gap-1">
              {PRESET_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  onClick={() => { setSolAmount(String(amt)); setSwapStep("idle"); setQuoteData(null); }}
                  className={`flex-1 py-1 text-[10px] font-medium rounded border transition-colors ${
                    solAmount === String(amt) ? "bg-primary/20 text-primary border-primary/30" : "bg-muted/20 text-muted-foreground border-border hover:text-foreground"
                  }`}
                  disabled={swapLoading}
                >{amt}</button>
              ))}
            </div>
          </div>

          {estimateText && swapStep === "quoted" && (
            <div className="text-xs text-primary font-medium mb-3 text-center">{estimateText}</div>
          )}
          {swapError && <div className="text-xs text-destructive mb-3 text-center">{swapError}</div>}
          {swapStep === "done" && <div className="text-xs text-primary mb-3 text-center font-semibold">✅ Swap successful!</div>}

          {!quoteData || swapStep === "error" ? (
            <Button className="w-full h-9 text-xs" onClick={handleGetQuote} disabled={swapLoading || !tokenMint.trim() || !solAmount || parseFloat(solAmount) <= 0}>
              {swapStep === "quoting" ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Getting quote...</> : "Get Quote"}
            </Button>
          ) : (
            <Button className="w-full h-9 text-xs bg-primary hover:bg-primary/90" onClick={handleSwap} disabled={swapLoading || !walletAddress || !signTransaction}>
              {swapLoading ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Processing...</> : "Execute swap"}
            </Button>
          )}
        </div>
      </div>
    </aside>
  );
};

export default RightSidebar;
