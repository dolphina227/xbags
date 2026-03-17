import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowRightLeft, AlertCircle, CheckCircle2 } from "lucide-react";
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
  priceChange24h?: number | null;
  priceChange?: {
    m5?: number | null;
    h1?: number | null;
    h6?: number | null;
    h24?: number | null;
  } | null;
  volume24h?: number | null;
  marketCap: number | null;
  url?: string;
}

interface QuickBuyModalProps {
  token: Token | null;
  onClose: () => void;
}

const PRESET_AMOUNTS = [0.1, 0.5, 1, 2];

const formatTokenPrice = (price: string | null) => {
  if (!price) return "-";
  const num = parseFloat(price);
  if (isNaN(num)) return "-";
  if (num === 0) return "$0";
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(2)}K`;
  if (num >= 1) return `$${num.toFixed(2)}`;
  if (num >= 0.01) return `$${num.toFixed(4)}`;
  if (num >= 0.0001) return `$${num.toFixed(6)}`;
  const str = num.toFixed(20);
  const match = str.match(/^0\.(0+)(\d{4})/);
  if (match) {
    const zeroCount = match[1].length;
    const significantDigits = match[2];
    return `$0.0₍${zeroCount}₎${significantDigits}`;
  }
  return `$${num.toExponential(2)}`;
};

type SwapStep = "idle" | "quoting" | "quoted" | "signing" | "sending" | "confirming" | "done" | "error";

const QuickBuyModal = ({ token, onClose }: QuickBuyModalProps) => {
  const [solAmount, setSolAmount] = useState("0.1");
  const [step, setStep] = useState<SwapStep>("idle");
  const [quoteData, setQuoteData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const { address: walletAddress, network, refreshBalance } = useWallet();
  const { connection } = useConnection();
  const { signTransaction } = useSolanaWallet();
  const { toast } = useToast();

  const loading = ["quoting", "signing", "sending", "confirming"].includes(step);

  const resetState = () => {
    setStep("idle");
    setQuoteData(null);
    setError(null);
    setTxSignature(null);
  };

  const handleGetQuote = async () => {
    if (!token) return;
    setStep("quoting");
    setError(null);
    setQuoteData(null);

    try {
      const amountLamports = Math.floor(parseFloat(solAmount) * 1_000_000_000);

      const { data, error: fnError } = await supabase.functions.invoke('bags-trade', {
        body: {
          action: 'quote',
          inputMint: SOL_MINT,
          outputMint: token.tokenAddress,
          amount: amountLamports,
          slippageMode: 'auto',
        },
      });

      if (fnError) throw new Error(fnError.message);
      if (!data?.success) throw new Error(data?.error || 'Failed to get quote');

      setQuoteData(data.response);
      setStep("quoted");
    } catch (err: any) {
      setError(err.message || 'Failed to get quote');
      setStep("error");
    }
  };

  const handleSwap = async () => {
    if (!quoteData || !walletAddress || !token || !signTransaction) return;

    try {
      // Pre-flight balance check
      const { Connection } = await import("@solana/web3.js");
      const conn = new Connection(getRpcUrl(), "confirmed");
      const balance = await conn.getBalance(new PublicKey(walletAddress));
      const balanceSol = balance / 1_000_000_000;
      const needed = parseFloat(solAmount) + 0.003;
      if (balanceSol < needed) {
        throw new Error("insufficient funds");
      }

      // Step 1: Get swap transaction from backend
      setStep("signing");
      setError(null);

      const { data, error: fnError } = await supabase.functions.invoke('bags-trade', {
        body: {
          action: 'swap',
          quoteResponse: quoteData,
          userPublicKey: walletAddress,
        },
      });

      if (fnError) throw new Error(fnError.message);

      // Handle both response formats (nested and flat)
      const swapTxBase58 = data?.swapTransaction || data?.response?.swapTransaction;
      if (!swapTxBase58) {
        throw new Error('No swap transaction returned from API');
      }

      // Step 2: Decode Base58 → VersionedTransaction
      const txBytes = bs58.decode(swapTxBase58);
      const transaction = VersionedTransaction.deserialize(txBytes);

      // Step 3: Sign with user's wallet
      const signedTx = await signTransaction(transaction);

      // Step 4: Send signed transaction
      setStep("sending");
      const rawTx = signedTx.serialize();
      const signature = await connection.sendRawTransaction(rawTx, {
        skipPreflight: false,
        maxRetries: 3,
      });

      // Step 5: Confirm transaction
      setStep("confirming");
      const latestBlockhash = await connection.getLatestBlockhash();
      await connection.confirmTransaction({
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      }, "confirmed");

      setTxSignature(signature);
      setStep("done");

      toast({
        title: "Swap successful! 🎉",
        description: `Bought ${token.symbol || token.name} with ${solAmount} SOL`,
      });

      // Refresh balance after swap
      setTimeout(refreshBalance, 2000);

    } catch (err: any) {
      const parsed = parseRpcError(err);
      setError(parsed.message);
      setStep("error");
      toast({
        title: parsed.title,
        description: parsed.message,
        variant: "destructive",
      });
    }
  };

  const formatOutAmount = (amount: string, decimals?: number) => {
    const dec = decimals || 9;
    const num = parseInt(amount) / Math.pow(10, dec);
    if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
    if (num >= 1) return num.toFixed(2);
    if (num >= 0.0001) return num.toFixed(4);
    return num.toExponential(2);
  };

  const getOutputDecimals = () => {
    if (quoteData?.routePlan?.length > 0) {
      const lastRoute = quoteData.routePlan[quoteData.routePlan.length - 1];
      return lastRoute.outputMintDecimals;
    }
    return 6; // Most SPL tokens use 6 decimals
  };

  const getStepLabel = () => {
    switch (step) {
      case "quoting": return "Getting Quote...";
      case "signing": return "Sign in your wallet...";
      case "sending": return "Sending transaction...";
      case "confirming": return "Confirming...";
      default: return "";
    }
  };

  const explorerUrl = txSignature
    ? `https://solscan.io/tx/${txSignature}${network === "devnet" ? "?cluster=devnet" : ""}`
    : null;

  return (
    <Dialog open={!!token} onOpenChange={(open) => {
      if (!open) {
        resetState();
        onClose();
      }
    }}>
      <DialogContent className="sm:max-w-[380px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            Quick Buy {token?.symbol || token?.name}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Swap SOL for {token?.symbol || token?.name} via XBAGS Trade
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Token Info */}
          {token && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className="h-10 w-10 rounded-full bg-muted overflow-hidden shrink-0">
                {token.icon ? (
                  <img src={token.icon} alt={token.symbol || ''} className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <div className="h-10 w-10 flex items-center justify-center text-xs font-bold text-primary">
                    {token.symbol?.slice(0, 2) || '?'}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-foreground">{token.symbol || token.name}</div>
                <div className="text-xs text-muted-foreground truncate">{token.name}</div>
              </div>
              <div className="text-sm font-semibold text-foreground">
                {formatTokenPrice(token.priceUsd)}
              </div>
            </div>
          )}

          {/* Success State */}
          {step === "done" && (
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-center space-y-2">
              <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto" />
              <p className="text-sm font-semibold text-foreground">Swap Successful!</p>
              <p className="text-xs text-muted-foreground">
                Bought {token?.symbol} with {solAmount} SOL
              </p>
              {explorerUrl && (
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline inline-block"
                >
                  View on Solscan →
                </a>
              )}
              <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => { resetState(); onClose(); }}>
                Close
              </Button>
            </div>
          )}

          {/* Main Flow (not done) */}
          {step !== "done" && (
            <>
              {/* SOL Amount */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Amount (SOL)</label>
                <Input
                  type="number"
                  value={solAmount}
                  onChange={(e) => {
                    setSolAmount(e.target.value);
                    setQuoteData(null);
                    setStep("idle");
                    setError(null);
                  }}
                  placeholder="0.0"
                  className="bg-background border-border"
                  step="0.1"
                  min="0.01"
                  disabled={loading}
                />
                <div className="flex gap-1.5">
                  {PRESET_AMOUNTS.map((amt) => (
                    <Button
                      key={amt}
                      variant={solAmount === String(amt) ? "default" : "outline"}
                      size="sm"
                      className="flex-1 h-7 text-xs"
                      disabled={loading}
                      onClick={() => {
                        setSolAmount(String(amt));
                        setQuoteData(null);
                        setStep("idle");
                        setError(null);
                      }}
                    >
                      {amt} SOL
                    </Button>
                  ))}
                </div>
              </div>

              {/* Quote Result */}
              {quoteData && (
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">You'll receive</span>
                    <span className="font-semibold text-foreground">
                      ~{formatOutAmount(quoteData.outAmount, getOutputDecimals())} {token?.symbol}
                    </span>
                  </div>
                  {quoteData.priceImpactPct && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Price Impact</span>
                      <span className={`font-medium ${parseFloat(quoteData.priceImpactPct) > 5 ? 'text-destructive' : 'text-foreground'}`}>
                        {parseFloat(quoteData.priceImpactPct).toFixed(2)}%
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Slippage</span>
                    <span className="text-foreground">{(quoteData.slippageBps / 100).toFixed(1)}%</span>
                  </div>
                  {quoteData.minOutAmount && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Min received</span>
                      <span className="text-foreground">
                        ~{formatOutAmount(quoteData.minOutAmount, getOutputDecimals())} {token?.symbol}
                      </span>
                    </div>
                  )}
                  {quoteData.platformFee?.amount && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Platform Fee</span>
                      <span className="text-foreground">
                        {(parseInt(quoteData.platformFee.amount) / 1_000_000_000).toFixed(4)} SOL
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Step Progress */}
              {loading && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                  <span className="text-sm text-foreground">{getStepLabel()}</span>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Wallet Warning */}
              {!walletAddress && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20 text-sm text-warning">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>Connect your wallet to trade</span>
                </div>
              )}

              {/* Sign Transaction Warning */}
              {walletAddress && !signTransaction && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20 text-sm text-warning">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>Your wallet doesn't support transaction signing</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                {!quoteData || step === "error" ? (
                  <Button
                    className="flex-1"
                    onClick={handleGetQuote}
                    disabled={loading || !solAmount || parseFloat(solAmount) <= 0}
                  >
                    {step === "quoting" ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        Getting Quote...
                      </>
                    ) : step === "error" ? (
                      "Retry Quote"
                    ) : (
                      "Get Quote"
                    )}
                  </Button>
                ) : (
                  <Button
                    className="flex-1 bg-primary hover:bg-primary/90"
                    onClick={handleSwap}
                    disabled={loading || !walletAddress || !signTransaction}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        {getStepLabel()}
                      </>
                    ) : (
                      `Sign & Buy ${token?.symbol} for ${solAmount} SOL`
                    )}
                  </Button>
                )}
              </div>
            </>
          )}

          {/* Powered by */}
          <p className="text-[10px] text-center text-muted-foreground">
            Powered by bags.fm
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QuickBuyModal;
