import { useState, useEffect } from "react";
import { ArrowLeft, ExternalLink, Globe, Loader2, Users, Settings, ChevronUp, ChevronDown, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/hooks/use-wallet";
import { useConnection } from "@solana/wallet-adapter-react";
import { useWallet as useSolanaWallet } from "@solana/wallet-adapter-react";
import { VersionedTransaction, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { useToast } from "@/hooks/use-toast";
import { parseRpcError, getRpcUrl } from "@/lib/solana-utils";

const SOL_MINT = "So11111111111111111111111111111111111111112";

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

interface TokenDetailProps {
  token: Token;
  onBack: () => void;
}

function formatPrice(p: string | null): string {
  if (!p) return "—";
  const n = parseFloat(p);
  if (isNaN(n) || n === 0) return "$0";
  if (n >= 1_000) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  if (n >= 0.0001) return `$${n.toFixed(6)}`;
  const fixed = n.toFixed(20);
  const match = fixed.match(/^0\.(0+)([1-9]\d{0,3})/);
  if (match) {
    const zeros = match[1].length;
    const sig = match[2];
    const sub = zeros.toString().split("").map(d => "₀₁₂₃₄₅₆₇₈₉"[parseInt(d)]).join("");
    return `$0.0${sub}${sig}`;
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

export default function TokenDetail({ token, onBack }: TokenDetailProps) {
  const { toast } = useToast();
  const [swapMode, setSwapMode] = useState<"buy" | "sell">("buy");
  const [solAmount, setSolAmount] = useState("0.5");
  const [slippage, setSlippage] = useState("2");
  const [priorityFee, setPriorityFee] = useState("0.001");
  const [step, setStep] = useState<string>("idle");
  const [quoteData, setQuoteData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showCustom, setShowCustom] = useState(true);
  const [copied, setCopied] = useState(false);

  // Fetch pair data dari DexScreener untuk social links dan bubblemaps pair address
  const [pairData, setPairData] = useState<{
    pairAddress: string | null;
    socials: { type: string; url: string }[];
    websites: { url: string }[];
  }>({ pairAddress: null, socials: [], websites: [] });

  useEffect(() => {
    let cancelled = false;
    fetch(`https://api.dexscreener.com/tokens/v1/solana/${token.tokenAddress}`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        const pair = Array.isArray(data) ? data[0] : data?.pairs?.[0];
        if (pair) {
          setPairData({
            pairAddress: pair.pairAddress || null,
            socials: pair.info?.socials || [],
            websites: pair.info?.websites || [],
          });
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [token.tokenAddress]);

  const [settingsBuyAmounts, setSettingsBuyAmounts] = useState(["0.1", "0.5", "1"]);
  const [settingsSellPercents, setSettingsSellPercents] = useState(["25", "50", "100"]);
  const [settingsSlippage, setSettingsSlippage] = useState("2");
  const [settingsFee, setSettingsFee] = useState("0.001");

  const buyPresets = settingsBuyAmounts.map(Number);
  const sellPresets = settingsSellPercents.map(Number);

  const { address: walletAddress, network, refreshBalance, solPrice } = useWallet();
  const { connection } = useConnection();
  const { signTransaction } = useSolanaWallet();
  const loading = ["quoting", "signing", "sending", "confirming"].includes(step);

  // ── Token balance untuk sell ──────────────────────────
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);
  const [tokenDecimals, setTokenDecimals] = useState<number>(6);

  const refreshTokenBalance = async () => {
    if (!walletAddress || !token.tokenAddress) return;
    try {
      const { Connection: Conn, PublicKey: PK } = await import("@solana/web3.js");
      const conn = new Conn(getRpcUrl(), "confirmed");
      const accounts = await conn.getParsedTokenAccountsByOwner(
        new PK(walletAddress),
        { mint: new PK(token.tokenAddress) }
      );
      if (accounts.value.length > 0) {
        const info = accounts.value[0].account.data.parsed.info;
        setTokenDecimals(info.tokenAmount.decimals as number);
        setTokenBalance(info.tokenAmount.uiAmount as number);
      } else {
        setTokenBalance(0);
      }
    } catch {
      // silent
    }
  };

  useEffect(() => {
    refreshTokenBalance();
  }, [walletAddress, token.tokenAddress]);

  const dexScreenerChartUrl = `https://dexscreener.com/solana/${token.tokenAddress}?embed=1&theme=dark&trades=1&info=0`;

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(token.tokenAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGetQuote = async () => {
    setStep("quoting");
    setError(null);
    setQuoteData(null);
    try {
      let amountRaw: number;

      if (swapMode === "buy") {
        // Buy: solAmount dalam SOL → kalikan 1_000_000_000 (lamports)
        amountRaw = Math.floor(parseFloat(solAmount) * 1_000_000_000);
      } else {
        // Sell: solAmount berisi persentase (25, 50, 100)
        // Hitung jumlah token = balance × persen / 100
        if (tokenBalance === null || tokenBalance <= 0) {
          throw new Error("No token balance to sell");
        }
        const pct = parseFloat(solAmount) / 100;
        const tokenAmount = tokenBalance * pct;
        // Konversi ke raw units berdasarkan decimals token
        amountRaw = Math.floor(tokenAmount * Math.pow(10, tokenDecimals));
        if (amountRaw <= 0) throw new Error("Invalid sell amount");
      }

      const inputMint = swapMode === "buy" ? SOL_MINT : token.tokenAddress;
      const outputMint = swapMode === "buy" ? token.tokenAddress : SOL_MINT;
      const { data, error: fnError } = await supabase.functions.invoke("bags-trade", {
        body: { action: "quote", inputMint, outputMint, amount: amountRaw, slippageMode: "manual", slippageBps: Math.floor(parseFloat(slippage) * 100) },
      });
      if (fnError) throw new Error(fnError.message);
      if (!data?.success) throw new Error(data?.error || "Quote failed");
      setQuoteData(data.response);
      setStep("quoted");
    } catch (err: any) {
      setError(err.message);
      setStep("error");
    }
  };

  const handleSwap = async () => {
    if (!quoteData || !walletAddress || !signTransaction) return;
    try {
      const { Connection } = await import("@solana/web3.js");
      const conn = new Connection(getRpcUrl(), "confirmed");
      const bal = await conn.getBalance(new PublicKey(walletAddress));
      if (swapMode === "buy" && bal / 1_000_000_000 < parseFloat(solAmount) + 0.003) throw new Error("Insufficient funds");
      setStep("signing");
      setError(null);
      const { data, error: fnError } = await supabase.functions.invoke("bags-trade", {
        body: { action: "swap", quoteResponse: quoteData, userPublicKey: walletAddress },
      });
      if (fnError) throw new Error(fnError.message);
      const swapTx = data?.swapTransaction || data?.response?.swapTransaction;
      if (!swapTx) throw new Error("No swap transaction");
      const txBytes = bs58.decode(swapTx);
      const tx = VersionedTransaction.deserialize(txBytes);
      const signed = await signTransaction(tx);
      setStep("sending");
      const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false, maxRetries: 3 });
      setStep("confirming");
      const bh = await connection.getLatestBlockhash();
      await connection.confirmTransaction({ signature: sig, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight }, "confirmed");
      setStep("done");
      toast({ title: "Swap successful! 🎉" });
      setTimeout(refreshBalance, 2000);
      setTimeout(refreshTokenBalance, 3000); // refresh token balance setelah swap
    } catch (err: any) {
      const parsed = parseRpcError(err);
      setError(parsed.message);
      setStep("error");
    }
  };

  const handleQuickBuy = (amt: number) => {
    setSolAmount(String(amt));
    setSwapMode("buy");
    setTimeout(() => { setStep("idle"); setQuoteData(null); }, 0);
  };

  const handleQuickSell = (pct: number) => {
    setSwapMode("sell");
    setSolAmount(String(pct));
    setStep("idle");
    setQuoteData(null);
  };

  const saveSettings = () => {
    setSlippage(settingsSlippage);
    setPriorityFee(settingsFee);
    setShowSettings(false);
    toast({ title: "Settings saved" });
  };

  const priceChange6h = token.priceChange?.h6;
  const priceChange24h = token.priceChange?.h24;

  return (
    <div className="py-4">
      {/* Back button */}
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Back to Market
      </button>

      {/* Main content: Chart + Trade Panel */}
      <div className="flex flex-col xl:flex-row gap-4">
        {/* LEFT: Chart + Info - takes all available space */}
        <div className="flex-1 min-w-0">

          {/* Satu iframe DexScreener: chart + txns + top traders + holders + info */}
          <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ height: "clamp(700px, 85vh, 1000px)" }}>
            <iframe
              src={dexScreenerChartUrl}
              title="DexScreener"
              className="w-full h-full border-0"
              allow="clipboard-write"
              loading="lazy"
            />
          </div>

          {/* Links row */}
          <div className="flex gap-2 mt-4 flex-wrap">
            <a href={`https://dexscreener.com/solana/${token.tokenAddress}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-card border border-border rounded-full text-muted-foreground hover:text-foreground transition-colors">
              <Globe className="h-3 w-3" /> DexScreener
            </a>
            <a href={`https://solscan.io/token/${token.tokenAddress}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-card border border-border rounded-full text-muted-foreground hover:text-foreground transition-colors">
              <ExternalLink className="h-3 w-3" /> Solscan
            </a>
            <a href={`https://birdeye.so/token/${token.tokenAddress}?chain=solana`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-card border border-border rounded-full text-muted-foreground hover:text-foreground transition-colors">
              <ExternalLink className="h-3 w-3" /> Birdeye
            </a>
            <a href={`https://bags.fm/token/${token.tokenAddress}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-card border border-border rounded-full text-muted-foreground hover:text-foreground transition-colors">
              <ExternalLink className="h-3 w-3" /> Bags.fm
            </a>
            <a href={`https://solscan.io/token/${token.tokenAddress}#holders`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-card border border-border rounded-full text-muted-foreground hover:text-foreground transition-colors">
              <Users className="h-3 w-3" /> Holders
            </a>
          </div>
        </div>

        {/* RIGHT: Trade Panel */}
        <div className="w-full xl:w-[280px] shrink-0">
          <div className="bg-card border border-border rounded-xl p-4 xl:sticky xl:top-4 space-y-4">

            {/* Token header */}
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-muted border border-border flex items-center justify-center overflow-hidden shrink-0">
                {token.icon ? (
                  <img src={token.icon} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs font-bold text-primary">{(token.symbol || "?").slice(0, 2)}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-foreground">${token.symbol || "???"}</span>
                  {token.priceChange?.h1 != null && (
                    <span className={`text-xs font-semibold ${(token.priceChange.h1 ?? 0) >= 0 ? "text-green-400" : "text-destructive"}`}>
                      {(token.priceChange.h1 ?? 0) >= 0 ? "+" : ""}{token.priceChange.h1?.toFixed(1)}%
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatPrice(token.priceUsd)}
                  {token.marketCap ? ` MC ${formatMcap(token.marketCap)}` : ""}
                </div>
              </div>
            </div>

            {/* Timeframe changes */}
            <div className="flex gap-3 text-xs text-muted-foreground">
              {priceChange6h != null && (
                <span>6h <span className={priceChange6h >= 0 ? "text-green-400" : "text-destructive"}>{priceChange6h >= 0 ? "+" : ""}{priceChange6h.toFixed(1)}%</span></span>
              )}
              {priceChange24h != null && (
                <span>24h <span className={priceChange24h >= 0 ? "text-green-400" : "text-destructive"}>{priceChange24h >= 0 ? "+" : ""}{priceChange24h.toFixed(1)}%</span></span>
              )}
            </div>

            {/* ═══ QUICK TRADE ═══ */}
            <div>
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Quick Trade</h3>
              <div className="mb-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-muted-foreground uppercase">Buy</span>
                </div>
                <div className="flex gap-1.5 mt-1">
                  {buyPresets.map((amt) => (
                    <button key={amt} onClick={() => handleQuickBuy(amt)}
                      className="flex-1 py-2 text-xs font-semibold rounded-lg bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 transition-colors"
                      disabled={loading}>{amt} SOL</button>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-muted-foreground uppercase">Sell</span>
                  {tokenBalance !== null && tokenBalance > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      {tokenBalance.toLocaleString("en-US", { maximumFractionDigits: 4 })} ${token.symbol}
                    </span>
                  )}
                </div>
                <div className="flex gap-1.5 mt-1">
                  {sellPresets.map((pct) => (
                    <button key={pct} onClick={() => handleQuickSell(pct)}
                      className="flex-1 py-2 text-xs font-semibold rounded-lg bg-destructive/20 text-destructive border border-destructive/30 hover:bg-destructive/30 transition-colors"
                      disabled={loading || tokenBalance === 0}>{pct}%</button>
                  ))}
                </div>
                {tokenBalance === 0 && walletAddress && (
                  <p className="text-[10px] text-muted-foreground mt-1">No {token.symbol} to sell</p>
                )}
              </div>
              <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
                <span>Slippage {slippage}%  Fee {priorityFee} SOL</span>
                <button onClick={() => setShowSettings(!showSettings)} className="text-muted-foreground hover:text-foreground">
                  <Settings className="h-3.5 w-3.5" />
                </button>
              </div>
              {!walletAddress && <p className="text-xs text-destructive mt-1">No tokens to sell</p>}
            </div>

            {/* ═══ CUSTOM TRADE ═══ */}
            <div>
              <button onClick={() => setShowCustom(!showCustom)}
                className="flex items-center justify-between w-full text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Custom Trade
                {showCustom ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
              {showCustom && (
                <div className="mt-2 space-y-3">
                  <div className="flex gap-1 bg-muted/30 rounded-lg p-1">
                    <button onClick={() => setSwapMode("buy")}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${swapMode === "buy" ? "bg-green-500 text-white" : "text-muted-foreground"}`}>Buy</button>
                    <button onClick={() => setSwapMode("sell")}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${swapMode === "sell" ? "bg-destructive text-destructive-foreground" : "text-muted-foreground"}`}>Sell</button>
                  </div>
                  <div>
                    {swapMode === "sell" ? (
                      <>
                        {/* Header: balance + nama token */}
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] text-muted-foreground">
                            Sell <span className="text-foreground font-semibold">{tokenBalance !== null ? tokenBalance.toLocaleString("en-US", { maximumFractionDigits: 4 }) : "0"}</span>
                          </span>
                          <span className="text-[10px] text-muted-foreground font-medium">${token.symbol}</span>
                        </div>
                        {tokenBalance !== null && tokenBalance <= 0 && (
                          <p className="text-xs text-destructive mb-1">No {token.symbol} balance to sell</p>
                        )}
                        {/* Preset % buttons */}
                        <div className="flex items-center gap-1.5 mb-2">
                          {[10, 25, 50, 100].map((pct) => (
                            <button key={pct}
                              onClick={() => {
                                setSolAmount(String(pct));
                                setStep("idle"); setQuoteData(null); setError(null);
                              }}
                              disabled={loading || tokenBalance === 0}
                              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                                solAmount === String(pct)
                                  ? "bg-destructive text-destructive-foreground border-destructive"
                                  : "bg-muted/40 text-muted-foreground border-border hover:text-foreground hover:border-primary/40"
                              }`}
                            >{pct}%</button>
                          ))}
                        </div>
                        {/* Input manual jumlah token */}
                        <Input
                          type="number"
                          value={tokenBalance !== null && solAmount ? (tokenBalance * parseFloat(solAmount || "0") / 100).toFixed(4) : ""}
                          onChange={(e) => {
                            // Konversi token amount ke persen
                            if (tokenBalance && tokenBalance > 0) {
                              const pct = (parseFloat(e.target.value) / tokenBalance) * 100;
                              setSolAmount(String(Math.min(100, Math.max(0, pct))));
                            }
                            setStep("idle"); setQuoteData(null); setError(null);
                          }}
                          placeholder={`Token amount`}
                          className="bg-background border-border text-sm h-9"
                          step="0.01" min="0"
                          disabled={loading || tokenBalance === 0} />
                        {/* Estimasi SOL diterima */}
                        {tokenBalance !== null && tokenBalance > 0 && solAmount && parseFloat(solAmount) > 0 && token.priceUsd && parseFloat(token.priceUsd) > 0 && solPrice && solPrice > 0 && (
                          <div className="flex flex-col gap-0.5 mt-1.5 px-2 py-1.5 rounded-lg bg-muted/20 border border-border/40">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-muted-foreground">You sell</span>
                              <span className="text-xs font-semibold text-destructive">
                                {(tokenBalance * parseFloat(solAmount) / 100).toLocaleString("en-US", { maximumFractionDigits: 4 })} ${token.symbol}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-muted-foreground">Est. receive</span>
                              <span className="text-xs font-semibold text-green-400">
                                ≈ {((tokenBalance * parseFloat(solAmount) / 100 * parseFloat(token.priceUsd)) / solPrice).toLocaleString("en-US", { maximumFractionDigits: 6 })} SOL
                              </span>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        {/* Header: SOL label */}
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] text-muted-foreground">Buy Amount</span>
                          <span className="text-[10px] text-muted-foreground font-medium">SOL</span>
                        </div>
                        {/* Preset SOL buttons */}
                        <div className="flex items-center gap-1.5 mb-2">
                          {[0.1, 0.5, 1, 2].map((amt) => (
                            <button key={amt}
                              onClick={() => { setSolAmount(String(amt)); setStep("idle"); setQuoteData(null); setError(null); }}
                              disabled={loading}
                              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                                solAmount === String(amt)
                                  ? "bg-green-500 text-white border-green-500"
                                  : "bg-muted/40 text-muted-foreground border-border hover:text-foreground hover:border-primary/40"
                              }`}
                            >{amt}</button>
                          ))}
                        </div>
                        {/* Input manual SOL — selalu tampil */}
                        <Input type="number" value={solAmount}
                          onChange={(e) => { setSolAmount(e.target.value); setStep("idle"); setQuoteData(null); setError(null); }}
                          placeholder="0.5 SOL"
                          className="bg-background border-border text-sm h-9"
                          step="0.1" min="0.01"
                          disabled={loading} />
                        {/* You buy + Est. receive — format sama dengan sell */}
                        {solAmount && parseFloat(solAmount) > 0 && token.priceUsd && parseFloat(token.priceUsd) > 0 && solPrice && solPrice > 0 && (
                          <div className="flex flex-col gap-0.5 mt-1.5 px-2 py-1.5 rounded-lg bg-muted/20 border border-border/40">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-muted-foreground">You buy</span>
                              <span className="text-xs font-semibold text-green-400">
                                {parseFloat(solAmount).toLocaleString("en-US", { maximumFractionDigits: 4 })} SOL
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-muted-foreground">Est. receive</span>
                              <span className="text-xs font-semibold text-green-400">
                                ≈ {((parseFloat(solAmount) * solPrice) / parseFloat(token.priceUsd)).toLocaleString("en-US", { maximumFractionDigits: 4 })} ${token.symbol}
                              </span>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-[10px] text-muted-foreground uppercase">Slippage</label>
                      <div className="flex items-center gap-1 mt-1">
                        <Input type="number" value={slippage} onChange={(e) => setSlippage(e.target.value)}
                          className="bg-background border-border text-xs h-8 w-full" step="0.5" min="0.1" disabled={loading} />
                        <span className="text-xs text-muted-foreground">%</span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] text-muted-foreground uppercase">Tip</label>
                      <div className="flex items-center gap-1 mt-1">
                        <Input type="number" value={priorityFee} onChange={(e) => setPriorityFee(e.target.value)}
                          className="bg-background border-border text-xs h-8 w-full" step="0.001" min="0" disabled={loading} />
                        <span className="text-xs text-muted-foreground shrink-0">SOL</span>
                      </div>
                    </div>
                  </div>
                  {quoteData && step === "quoted" && (
                    <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/30 border border-border">
                      <span className="text-[10px] text-muted-foreground uppercase">You receive</span>
                      <span className="text-sm font-bold text-green-400">
                        ≈ {swapMode === "buy"
                          ? (parseInt(quoteData.outAmount) / Math.pow(10, tokenDecimals)).toLocaleString("en-US", { maximumFractionDigits: 4 })
                          : (parseInt(quoteData.outAmount) / 1_000_000_000).toLocaleString("en-US", { maximumFractionDigits: 6 })
                        } {swapMode === "buy" ? token.symbol : "SOL"}
                      </span>
                    </div>
                  )}
                  {error && <div className="text-xs text-destructive text-center">{error}</div>}
                  {step === "done" && <div className="text-xs text-green-400 text-center font-semibold">✅ Swap successful!</div>}
                  {!quoteData || step === "error" ? (
                    <Button className={`w-full h-10 text-sm font-bold ${swapMode === "buy" ? "bg-green-500 hover:bg-green-600 text-white" : "bg-destructive hover:bg-destructive/90 text-destructive-foreground"}`}
                      onClick={handleGetQuote} disabled={loading || parseFloat(solAmount) <= 0}>
                      {step === "quoting" ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Quoting...</> : swapMode === "buy" ? "BUY" : "SELL"}
                    </Button>
                  ) : (
                    <Button className={`w-full h-10 text-sm font-bold ${swapMode === "buy" ? "bg-green-500 hover:bg-green-600 text-white" : "bg-destructive hover:bg-destructive/90 text-destructive-foreground"}`}
                      onClick={handleSwap} disabled={loading || !walletAddress || !signTransaction}>
                      {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Processing...</> : swapMode === "buy" ? "BUY" : "SELL"}
                    </Button>
                  )}
                  {!walletAddress && <p className="text-[10px] text-muted-foreground text-center">Connect wallet to trade</p>}
                </div>
              )}
            </div>

            {/* ═══ SETTINGS ═══ */}
            {showSettings && (
              <div className="border-t border-border pt-3 space-y-3">
                <h4 className="text-xs font-bold text-muted-foreground uppercase">Settings</h4>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] text-muted-foreground">Slippage (%)</label>
                    <Input type="number" value={settingsSlippage} onChange={(e) => setSettingsSlippage(e.target.value)} className="bg-background border-border text-xs h-8 mt-1" step="0.5" />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-muted-foreground">Priority Fee (SOL)</label>
                    <Input type="number" value={settingsFee} onChange={(e) => setSettingsFee(e.target.value)} className="bg-background border-border text-xs h-8 mt-1" step="0.001" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Buy Amounts (SOL)</label>
                  <div className="flex gap-1 mt-1">
                    {settingsBuyAmounts.map((v, i) => (
                      <Input key={i} type="number" value={v}
                        onChange={(e) => { const arr = [...settingsBuyAmounts]; arr[i] = e.target.value; setSettingsBuyAmounts(arr); }}
                        className="bg-background border-border text-xs h-8" step="0.1" />
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Sell Amounts (%)</label>
                  <div className="flex gap-1 mt-1">
                    {settingsSellPercents.map((v, i) => (
                      <Input key={i} type="number" value={v}
                        onChange={(e) => { const arr = [...settingsSellPercents]; arr[i] = e.target.value; setSettingsSellPercents(arr); }}
                        className="bg-background border-border text-xs h-8" step="5" />
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 h-8 text-xs" onClick={saveSettings}>Save</Button>
                  <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => setShowSettings(false)}>Cancel</Button>
                </div>
              </div>
            )}

            {/* CA + Social Links */}
            <div className="border-t border-border pt-3 space-y-3">
              {/* Contract Address */}
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Contract Address</p>
                <button
                  onClick={handleCopyAddress}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-muted/40 border border-border hover:border-primary/40 transition-colors group"
                >
                  <span className="text-xs font-mono text-foreground truncate">
                    {token.tokenAddress.slice(0, 8)}...{token.tokenAddress.slice(-8)}
                  </span>
                  {copied
                    ? <Check className="h-3.5 w-3.5 text-green-400 shrink-0" />
                    : <Copy className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />}
                </button>
              </div>

              {/* Social & Explorer Links */}
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Links</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {/* Explorer links — selalu tampil */}
                  <a href={`https://solscan.io/token/${token.tokenAddress}`} target="_blank" rel="noopener noreferrer"
                    className="flex flex-col items-center gap-1 py-2 rounded-lg bg-muted/30 border border-border hover:border-primary/40 hover:text-foreground text-muted-foreground transition-colors text-[10px]">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Solscan
                  </a>

                  {/* Social links dari DexScreener — hanya tampil jika ada datanya */}
                  {pairData.websites.map((w, i) => (
                    <a key={`web-${i}`} href={w.url} target="_blank" rel="noopener noreferrer"
                      className="flex flex-col items-center gap-1 py-2 rounded-lg bg-muted/30 border border-border hover:border-primary/40 hover:text-foreground text-muted-foreground transition-colors text-[10px]">
                      <Globe className="h-3.5 w-3.5" />
                      Website
                    </a>
                  ))}
                  {pairData.socials.map((s, i) => {
                    const isX = s.type === "twitter" || s.url?.includes("twitter.com") || s.url?.includes("x.com");
                    const isTg = s.type === "telegram" || s.url?.includes("t.me");
                    return (
                      <a key={`soc-${i}`} href={s.url} target="_blank" rel="noopener noreferrer"
                        className="flex flex-col items-center gap-1 py-2 rounded-lg bg-muted/30 border border-border hover:border-primary/40 hover:text-foreground text-muted-foreground transition-colors text-[10px]">
                        {isX ? (
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                          </svg>
                        ) : isTg ? (
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                          </svg>
                        ) : (
                          <ExternalLink className="h-3.5 w-3.5" />
                        )}
                        {isX ? "Twitter" : isTg ? "Telegram" : "Social"}
                      </a>
                    );
                  })}

                  {/* Bags.fm */}
                  <a href={`https://bags.fm/token/${token.tokenAddress}`} target="_blank" rel="noopener noreferrer"
                    className="flex flex-col items-center gap-1 py-2 rounded-lg bg-muted/30 border border-border hover:border-primary/40 hover:text-foreground text-muted-foreground transition-colors text-[10px]">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Bags.fm
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}