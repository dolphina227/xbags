import { motion } from "framer-motion";
import { Users, Copy, Gift, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const referrals = [
  { name: "Alex R.", date: "Mar 5, 2026", reward: "+50 pts" },
  { name: "Jamie L.", date: "Mar 3, 2026", reward: "+50 pts" },
  { name: "Morgan K.", date: "Feb 28, 2026", reward: "+50 pts" },
];

const ReferralPage = () => {
  const referralLink = "https://xbags/ref/creator123";
  const copyLink = () => { navigator.clipboard.writeText(referralLink); toast.success("Referral link copied!"); };

  return (
    <div className="container mx-auto max-w-2xl px-4 py-6">
      <div className="flex items-center gap-2 mb-6"><Users className="h-6 w-6 text-primary" /><h1 className="text-2xl font-bold">Referral Program</h1></div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-6 rounded-xl bg-gradient-to-r from-primary/10 to-transparent border border-primary/20 mb-8 text-center">
        <Gift className="h-10 w-10 text-primary mx-auto mb-3" />
        <h2 className="text-lg font-bold mb-1">Earn 50 points per referral</h2>
        <p className="text-sm text-muted-foreground">Invite friends and both of you earn rewards!</p>
      </motion.div>
      <div className="mb-8">
        <label className="text-sm font-medium mb-2 block">Your Referral Link</label>
        <div className="flex gap-2">
          <Input value={referralLink} readOnly className="bg-card border-border text-sm font-mono" />
          <Button onClick={copyLink} variant="outline" className="gap-2 border-primary/30 text-primary shrink-0"><Copy className="h-4 w-4" /> Copy</Button>
        </div>
        <div className="flex gap-2 mt-3">
          <Button variant="outline" size="sm" className="gap-2 border-border text-muted-foreground"><Share2 className="h-3.5 w-3.5" /> Share on Twitter</Button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[{ label: "Total Referrals", value: "12" }, { label: "Points Earned", value: "600" }, { label: "Active", value: "8" }].map((s) => (
          <div key={s.label} className="p-4 rounded-xl bg-card border border-border text-center">
            <div className="text-2xl font-bold text-primary">{s.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
          </div>
        ))}
      </div>
      <div>
        <h2 className="font-semibold mb-4">Recent Referrals</h2>
        <div className="space-y-2">
          {referrals.map((r, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="flex items-center justify-between p-3 rounded-lg bg-card border border-border">
              <div><div className="text-sm font-medium">{r.name}</div><div className="text-xs text-muted-foreground">{r.date}</div></div>
              <span className="text-sm font-medium text-success">{r.reward}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ReferralPage;
