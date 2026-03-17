import { useState } from "react";
import { Diamond, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useWallet } from "@/hooks/use-wallet";
import { toast } from "sonner";

const quickAmounts = [0.1, 0.5, 1, 5];

interface TipModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipientWallet: string;
  recipientName: string;
  recipientUsername: string | null;
}

export default function TipModal({
  isOpen,
  onClose,
  recipientWallet,
  recipientName,
  recipientUsername,
}: TipModalProps) {
  const { sendTransaction, solPrice, isSending } = useWallet();
  const [amount, setAmount] = useState("0.1");
  const [message, setMessage] = useState("");

  const amountNum = parseFloat(amount) || 0;
  const usdValue = solPrice ? (amountNum * solPrice).toFixed(2) : "—";
  const fee = 0.000005;

  const handleSend = async () => {
    if (amountNum <= 0) return toast.error("Enter a valid amount");

    const sig = await sendTransaction(recipientWallet, amountNum);
    if (sig) {
      toast.success(`Tipped ${amountNum} SOL to ${recipientName}! 💎`);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Diamond className="h-5 w-5 text-warning" />
            Send Tip to {recipientUsername ? `@${recipientUsername}` : recipientName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Quick amounts */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Quick amounts</p>
            <div className="grid grid-cols-4 gap-2">
              {quickAmounts.map((qa) => (
                <button
                  key={qa}
                  onClick={() => setAmount(String(qa))}
                  className={`py-2 rounded-lg text-xs font-semibold transition-all ${
                    amount === String(qa)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {qa} SOL
                </button>
              ))}
            </div>
          </div>

          {/* Custom amount */}
          <div>
            <p className="text-xs text-muted-foreground mb-1">Amount</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="flex-1 bg-muted rounded-lg px-3 py-2 text-sm text-foreground outline-none"
                step="0.01"
                min="0.001"
              />
              <span className="text-sm text-muted-foreground">SOL</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">≈ ${usdValue} USD</p>
          </div>

          {/* Message */}
          <div>
            <p className="text-xs text-muted-foreground mb-1">Message (optional)</p>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Great content!"
              className="w-full bg-muted rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none"
              rows={2}
              maxLength={140}
            />
          </div>

          {/* Summary */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Network fee</span>
              <span className="text-foreground">~{fee} SOL</span>
            </div>
            <div className="flex justify-between text-sm font-semibold">
              <span className="text-muted-foreground">Total</span>
              <span className="text-foreground">{(amountNum + fee).toFixed(6)} SOL</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1" disabled={isSending}>
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={isSending || amountNum <= 0}
              className="flex-1 bg-primary text-primary-foreground hover:bg-secondary font-semibold"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Diamond className="h-4 w-4 mr-1" />
              )}
              Send Tip
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
