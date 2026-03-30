import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, TrendingDown, ChevronUp, ChevronDown,
  AlertTriangle, Info, Zap, Settings2
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useWallet } from "@/hooks/use-wallet";
import { useProfile } from "@/hooks/use-profile";
import { toast } from "sonner";
import type { PerpPair, PerpTicker } from "@/lib/perp/constants";
import { LEVERAGE_PRESETS } from "@/lib/perp/constants";

type OrderType = "market" | "limit" | "stop-limit";
type MarginMode = "cross" | "isolated";
type Side = "long" | "short";

interface PerpTradingPanelProps {
  pair: PerpPair;
  ticker: PerpTicker | null;
}

const formatNum = (n: number, d = 2) =>
  n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` :
  n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` :
  n >= 1e3 ? `${(n / 1e3).toFixed(2)}K` :
  n.toFixed(d);

const PerpTradingPanel = ({ pair, ticker }: PerpTradingPanelProps) => {
  const { status, balance } = useWallet();
  const { profile } = useProfile();

  // Order settings
  const [side, setSide] = useState<Side>("long");
  const [orderType, setOrderType] = useState<OrderType>("market");
  const [marginMode, setMarginMode] = useState<MarginMode>("cross");
  const [leverage, setLeverage] = useState(10);
  const [showLeverageSlider, setShowLeverageSlider] = useState(false);

  // Order values
  const [price, setPrice] = useState("");
  const [stopPrice, setStopPrice] = useState("");
  const [amount, setAmount] = useState("");
  const [total, setTotal] = useState("");
  const [sizePercent, setSizePercent] = useState(0);

  // Options
  const [reduceOnly, setReduceOnly] = useState(false);
  const [postOnly, setPostOnly] = useState(false);
  const [tpsl, setTpsl] = useState(false);
  const [tpPrice, setTpPrice] = useState("");
  const [slPrice, setSlPrice] = useState("");

  const markPrice = ticker?.markPrice ?? ticker?.price ?? 0;
  const availableBalance = balance ?? 0;

  // Compute derived values
  const computedTotal = useMemo(() => {
    const a = parseFloat(amount) || 0;
    const p = parseFloat(price) || markPrice;
    if (!a || !p) return 0;
    return a * p;
  }, [amount, price, markPrice]);

  const requiredMargin = useMemo(() => {
    if (!computedTotal || !leverage) return 0;
    return computedTotal / leverage;
  }, [computedTotal, leverage]);

  const estimatedLiquidation = useMemo(() => {
    if (!markPrice || !leverage) return 0;
    const maintenanceMargin = 0.005; // 0.5%
    if (side === "long") {
      return markPrice * (1 - 1 / leverage + maintenanceMargin);
    } else {
      return markPrice * (1 + 1 / leverage - maintenanceMargin);
    }
  }, [markPrice, leverage, side]);

  const handleSizePercent = (pct: number) => {
    setSizePercent(pct);
    const maxAmount = (availableBalance * leverage * pct) / 100;
    const p = parseFloat(price) || markPrice;
    if (p > 0) {
      setAmount((maxAmount / p).toFixed(4));
      setTotal(maxAmount.toFixed(2));
    } else {
      setTotal(maxAmount.toFixed(2));
    }
  };

  const handleAmountChange = (val: string) => {
    setAmount(val);
    const a = parseFloat(val) || 0;
    const p = parseFloat(price) || markPrice;
    if (a && p) setTotal((a * p).toFixed(2));
    else setTotal("");
  };

  const handleTotalChange = (val: string) => {
    setTotal(val);
    const t = parseFloat(val) || 0;
    const p = parseFloat(price) || markPrice;
    if (t && p) setAmount((t / p).toFixed(4));
    else setAmount("");
  };

  const handlePlaceOrder = useCallback(() => {
    if (status !== "connected") {
      toast.error("Connect your wallet first");
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (orderType !== "market" && (!price || parseFloat(price) <= 0)) {
      toast.error("Enter a valid price");
      return;
    }
    if (requiredMargin > availableBalance) {
      toast.error("Insufficient margin", {
        description: `Required: ${requiredMargin.toFixed(4)} SOL`,
      });
      return;
    }

    toast.success(`${side === "long" ? "Long" : "Short"} order placed!`, {
      description: `${pair.base} ${orderType} · ${amount} @ ${
        orderType === "market" ? "Market" : parseFloat(price).toFixed(2)
      } · ${leverage}x`,
    });

    setAmount("");
    setTotal("");
    setSizePercent(0);
  }, [status, amount, price, orderType, side, leverage, requiredMargin, availableBalance, pair.base]);

  const isPositive = (ticker?.changePercent24h ?? 0) >= 0;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Header: Price + Mark */}
      <div className="px-4 py-3 border-b border-border space-y-0.5">
        <div className="flex items-baseline gap-2">
          <span
            className={`text-xl font-bold font-mono ${
              isPositive ? "text-green-400" : "text-red-400"
            }`}
          >
            {markPrice > 0
              ? markPrice >= 1000
                ? markPrice.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
                : markPrice.toFixed(markPrice >= 1 ? 3 : 5)
              : "—"}
          </span>
          <span
            className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
              isPositive ? "text-green-400 bg-green-400/10" : "text-red-400 bg-red-400/10"
            }`}
          >
            {isPositive ? "+" : ""}
            {ticker?.changePercent24h?.toFixed(2) ?? "0.00"}%
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-mono">
          <span>Mark <span className="text-foreground">{ticker?.markPrice?.toFixed(2) ?? "—"}</span></span>
          <span>Index <span className="text-foreground">{ticker?.indexPrice?.toFixed(2) ?? "—"}</span></span>
          <span>
            Funding{" "}
            <span className="text-green-400">
              {ticker?.fundingRate !== undefined
                ? `${(ticker.fundingRate * 100).toFixed(4)}%`
                : "—"}
            </span>
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {/* Margin Mode + Leverage */}
        <div className="flex items-center justify-between">
          <div className="flex rounded-lg overflow-hidden border border-border text-xs">
            {(["cross", "isolated"] as MarginMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMarginMode(m)}
                className={`px-2.5 py-1.5 font-semibold transition-colors capitalize ${
                  marginMode === m
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowLeverageSlider(!showLeverageSlider)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-colors"
          >
            {leverage}x
            <Zap className="h-3 w-3" />
          </button>
        </div>

        {/* Leverage Slider */}
        <AnimatePresence>
          {showLeverageSlider && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="p-3 rounded-xl bg-muted/40 border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Leverage</span>
                  <span className="text-sm font-bold text-primary">{leverage}x</span>
                </div>
                <Slider
                  min={1}
                  max={pair.maxLeverage}
                  step={1}
                  value={[leverage]}
                  onValueChange={([v]) => setLeverage(v)}
                  className="w-full"
                />
                <div className="flex gap-1.5 flex-wrap">
                  {LEVERAGE_PRESETS.filter((p) => p <= pair.maxLeverage).map((lv) => (
                    <button
                      key={lv}
                      onClick={() => setLeverage(lv)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                        leverage === lv
                          ? "border-primary bg-primary/20 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      {lv}x
                    </button>
                  ))}
                </div>
                {leverage >= 20 && (
                  <div className="flex items-start gap-2 p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                    <AlertTriangle className="h-3 w-3 text-yellow-500 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-yellow-500/90">
                      High leverage increases liquidation risk. Use with caution.
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Long / Short Toggle */}
        <div className="grid grid-cols-2 rounded-xl overflow-hidden border border-border">
          <button
            onClick={() => setSide("long")}
            className={`py-2.5 text-sm font-bold transition-all ${
              side === "long"
                ? "bg-green-500 text-white"
                : "text-muted-foreground hover:text-green-400 hover:bg-green-500/10"
            }`}
          >
            <span className="flex items-center justify-center gap-1.5">
              <TrendingUp className="h-4 w-4" />
              Long
            </span>
          </button>
          <button
            onClick={() => setSide("short")}
            className={`py-2.5 text-sm font-bold transition-all ${
              side === "short"
                ? "bg-red-500 text-white"
                : "text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
            }`}
          >
            <span className="flex items-center justify-center gap-1.5">
              <TrendingDown className="h-4 w-4" />
              Short
            </span>
          </button>
        </div>

        {/* Order Type */}
        <div className="flex rounded-lg overflow-hidden border border-border text-xs">
          {(["market", "limit", "stop-limit"] as OrderType[]).map((t) => (
            <button
              key={t}
              onClick={() => setOrderType(t)}
              className={`flex-1 py-1.5 font-semibold transition-colors capitalize ${
                orderType === t
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "stop-limit" ? "Stop" : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Price Input (for limit / stop-limit) */}
        {orderType !== "market" && (
          <div>
            <label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-1 block">
              {orderType === "stop-limit" ? "Stop Price" : "Price"} (USDT)
            </label>
            <div className="relative">
              <Input
                type="number"
                value={orderType === "stop-limit" ? stopPrice : price}
                onChange={(e) =>
                  orderType === "stop-limit"
                    ? setStopPrice(e.target.value)
                    : setPrice(e.target.value)
                }
                placeholder={markPrice > 0 ? markPrice.toFixed(2) : "0.00"}
                className="bg-muted/50 border-border text-sm font-mono pr-16"
              />
              <button
                onClick={() =>
                  orderType === "stop-limit"
                    ? setStopPrice(markPrice.toFixed(2))
                    : setPrice(markPrice.toFixed(2))
                }
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-primary hover:text-primary/80"
              >
                Mark
              </button>
            </div>
          </div>
        )}

        {/* Limit price for stop-limit */}
        {orderType === "stop-limit" && (
          <div>
            <label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-1 block">
              Limit Price (USDT)
            </label>
            <Input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder={markPrice > 0 ? markPrice.toFixed(2) : "0.00"}
              className="bg-muted/50 border-border text-sm font-mono"
            />
          </div>
        )}

        {/* Amount */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
              Amount ({pair.base})
            </label>
            <span className="text-[10px] text-muted-foreground">
              Avail:{" "}
              <span className="text-foreground font-mono">{availableBalance.toFixed(4)} SOL</span>
            </span>
          </div>
          <div className="relative">
            <Input
              type="number"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              placeholder="0.000"
              className="bg-muted/50 border-border text-sm font-mono pr-12"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold">
              {pair.base}
            </span>
          </div>
        </div>

        {/* Size % buttons */}
        <div className="grid grid-cols-4 gap-1.5">
          {[25, 50, 75, 100].map((pct) => (
            <button
              key={pct}
              onClick={() => handleSizePercent(pct)}
              className={`py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${
                sizePercent === pct
                  ? "border-primary bg-primary/20 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}
            >
              {pct}%
            </button>
          ))}
        </div>

        {/* Total */}
        <div>
          <label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-1 block">
            Total (USDT)
          </label>
          <div className="relative">
            <Input
              type="number"
              value={total}
              onChange={(e) => handleTotalChange(e.target.value)}
              placeholder="0.00"
              className="bg-muted/50 border-border text-sm font-mono pr-16"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold">
              USDT
            </span>
          </div>
        </div>

        {/* TP/SL Toggle */}
        <div className="flex items-center justify-between py-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-semibold">TP/SL</span>
            <Switch checked={tpsl} onCheckedChange={setTpsl} />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground">Reduce Only</span>
              <Switch checked={reduceOnly} onCheckedChange={setReduceOnly} />
            </div>
          </div>
        </div>

        {/* TP/SL Inputs */}
        <AnimatePresence>
          {tpsl && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden space-y-2"
            >
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-green-400 font-semibold mb-1 block">
                    Take Profit
                  </label>
                  <Input
                    type="number"
                    value={tpPrice}
                    onChange={(e) => setTpPrice(e.target.value)}
                    placeholder="TP Price"
                    className="bg-green-500/5 border-green-500/20 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-red-400 font-semibold mb-1 block">
                    Stop Loss
                  </label>
                  <Input
                    type="number"
                    value={slPrice}
                    onChange={(e) => setSlPrice(e.target.value)}
                    placeholder="SL Price"
                    className="bg-red-500/5 border-red-500/20 text-xs font-mono"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Order Summary */}
        {(parseFloat(amount) > 0 || parseFloat(total) > 0) && (
          <div className="rounded-xl bg-muted/30 border border-border p-3 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Margin Required</span>
              <span className="font-mono text-foreground">{requiredMargin.toFixed(4)} SOL</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Max Position</span>
              <span className="font-mono text-foreground">
                {((availableBalance * leverage) / markPrice).toFixed(4)} {pair.base}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Est. Liquidation</span>
              <span className={`font-mono ${side === "long" ? "text-red-400" : "text-red-400"}`}>
                {estimatedLiquidation > 0 ? estimatedLiquidation.toFixed(2) : "—"}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Fee (0.05%)</span>
              <span className="font-mono text-foreground">
                {computedTotal > 0 ? (computedTotal * 0.0005).toFixed(4) : "0.0000"} USDT
              </span>
            </div>
          </div>
        )}

        {/* Place Order Button */}
        <button
          onClick={handlePlaceOrder}
          className={`w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-95 ${
            side === "long"
              ? "bg-green-500 hover:bg-green-400 text-white shadow-[0_0_20px_rgba(34,197,94,0.3)]"
              : "bg-red-500 hover:bg-red-400 text-white shadow-[0_0_20px_rgba(239,68,68,0.3)]"
          }`}
        >
          {status !== "connected"
            ? "Connect Wallet"
            : `${side === "long" ? "Long" : "Short"} ${pair.base} · ${leverage}x`}
        </button>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          {[
            { label: "24h High", value: ticker?.high24h?.toFixed(2) ?? "—", color: "text-green-400" },
            { label: "24h Low", value: ticker?.low24h?.toFixed(2) ?? "—", color: "text-red-400" },
            { label: "OI", value: ticker?.openInterest ? formatNum(ticker.openInterest) : "—", color: "text-foreground" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className={`text-xs font-bold font-mono ${s.color}`}>{s.value}</div>
              <div className="text-[9px] text-muted-foreground mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PerpTradingPanel;