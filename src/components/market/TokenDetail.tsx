import { useState } from "react";
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
  if (n >= 0.01) return `$${n.toFixed(5)}`;
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

  const [settingsBuyAmounts, setSettingsBuyAmounts] = useState(["0.1", "0.5", "1"]);
  const [settingsSellPercents, setSettingsSellPercents] = useState(["25", "50", "100"]);
  const [settingsSlippage, setSettingsSlippage] = useState("2");
  const [settingsFee, setSettingsFee] = useState("0.001");

  const buyPresets = settingsBuyAmounts.map(Number);
  const sellPresets = settingsSellPercents.map(Number);

  const { address: walletAddress, network, refreshBalance } = useWallet();
  const { connection } = useConnection();
  const { signTransaction } = useSolanaWallet();
  const loading = ["quoting", "signing", "sending", "confirming"].includes(step);

  const dexScreenerChartUrl = `https://dexscreener.com/solana/${token.tokenAddress}?embed=1&theme=dark&trades=0&info=0`;

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
      const amountLamports = Math.floor(parseFloat(solAmount) * 1_000_000_000);
      const inputMint = swapMode === "buy" ? SOL_MINT : token.tokenAddress;
      const outputMint = swapMode === "buy" ? token.tokenAddress : SOL_MINT;
      const { data, error: fnError } = await supabase.functions.invoke("bags-trade", {
        body: { action: "quote", inputMint, outputMint, amount: amountLamports, slippageMode: "manual", slippageBps: Math.floor(parseFloat(slippage) * 100) },
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
    <div className="py-2 lg:py-3">
      {/* Back button */}
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-2 transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Back to Market
      </button>

      {/* Main content: Chart + Trade Panel */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* LEFT: Chart + Info - takes all available space */}
        <div className="flex-1 min-w-0">
          {/* Chart - large on desktop */}
          <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ height: "clamp(460px, calc(100vh - 160px), 1000px)" }}>
            <iframe
              src={dexScreenerChartUrl}
              title="DexScreener Chart"
              className="w-full h-full border-0"
              allow="clipboard-write"
              loading="lazy"
            />
          </div>

          {/* Token info bar */}
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              {token.icon && <img src={token.icon} alt="" className="w-5 h-5 rounded-full" />}
              <span className="font-semibold text-foreground">{token.name}</span>
              <span>${token.symbol}</span>
            </div>
            <span className="text-foreground font-mono">{formatPrice(token.priceUsd)}</span>
            {token.marketCap && <span>MCap: {formatMcap(token.marketCap)}</span>}
            {token.volume24h && <span>Vol: {formatMcap(token.volume24h)}</span>}
            {token.liquidity && <span>Liq: {formatMcap(token.liquidity)}</span>}
            <button onClick={handleCopyAddress} className="flex items-center gap-1 hover:text-foreground transition-colors">
              {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
              {token.tokenAddress.slice(0, 6)}...{token.tokenAddress.slice(-4)}
            </button>
          </div>

          {/* Info tabs below chart */}
          <div className="mt-4 bg-card border border-border rounded-xl p-4">
            <div className="flex gap-4 border-b border-border pb-2 mb-3">
              <span className="text-sm font-semibold text-foreground border-b-2 border-primary pb-2">Trades</span>
              <a href={`https://solscan.io/token/${token.tokenAddress}#holders`} target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-foreground pb-2">Holders</a>
              <a href={`https://solscan.io/token/${token.tokenAddress}`} target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-foreground pb-2">Dev Info</a>
              <a href={`https://dexscreener.com/solana/${token.tokenAddress}`} target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-foreground pb-2">Top Traders</a>
            </div>
            <p className="text-sm text-muted-foreground text-center py-8">Coming soon</p>
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
        <div className="w-full lg:w-[340px] xl:w-[380px] shrink-0">
          <div className="bg-card border border-border rounded-xl p-4 lg:sticky lg:top-4 space-y-4 lg:max-h-[calc(100vh-100px)] lg:overflow-y-auto">

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
                <span className="text-[10px] text-muted-foreground uppercase">Buy</span>
                <div className="flex gap-1.5 mt-1">
                  {buyPresets.map((amt) => (
                    <button key={amt} onClick={() => handleQuickBuy(amt)}
                      className="flex-1 py-2 text-xs font-semibold rounded-lg bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 transition-colors"
                      disabled={loading}>{amt} SOL</button>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase">Sell</span>
                <div className="flex gap-1.5 mt-1">
                  {sellPresets.map((pct) => (
                    <button key={pct} onClick={() => handleQuickSell(pct)}
                      className="flex-1 py-2 text-xs font-semibold rounded-lg bg-destructive/20 text-destructive border border-destructive/30 hover:bg-destructive/30 transition-colors"
                      disabled={loading}>{pct}%</button>
                  ))}
                </div>
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
                    <label className="text-[10px] text-muted-foreground uppercase">Amount (SOL)</label>
                    <Input type="number" value={solAmount}
                      onChange={(e) => { setSolAmount(e.target.value); setStep("idle"); setQuoteData(null); setError(null); }}
                      placeholder="0.5" className="bg-background border-border text-sm h-9 mt-1" step="0.1" min="0.01" disabled={loading} />
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
                    <div className="text-xs text-green-400 font-medium text-center py-1">
                      ≈ {(parseInt(quoteData.outAmount) / 1_000_000_000).toLocaleString("en-US", { maximumFractionDigits: 4 })} {swapMode === "buy" ? token.symbol : "SOL"}
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

            <div className="border-t border-border pt-3 text-center">
              <p className="text-[10px] text-muted-foreground">Token analytics, holder info and more</p>
              <p className="text-[10px] text-muted-foreground">Coming soon</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}