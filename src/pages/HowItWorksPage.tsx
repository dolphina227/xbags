import { motion } from "framer-motion";
import { Wallet, PenTool, TrendingUp, Gift, Users, Zap } from "lucide-react";

const steps = [
  { icon: Wallet, title: "Connect Your Wallet", description: "Link your Solana wallet to get started. We support Phantom, Solflare, and more." },
  { icon: PenTool, title: "Create Content", description: "Share posts, art, articles, and more. Your content is stored on-chain." },
  { icon: Users, title: "Build Community", description: "Engage with other creators, follow, like, and comment to grow your network." },
  { icon: TrendingUp, title: "Earn Points", description: "Every interaction earns you points. Climb the leaderboard and unlock rewards." },
  { icon: Gift, title: "Claim Rewards", description: "Redeem your points for SOL, NFTs, and exclusive creator perks." },
  { icon: Zap, title: "Go Viral", description: "Use referrals and engagement tools to amplify your reach exponentially." },
];

const HowItWorksPage = () => {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-6">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold mb-3">How It Works</h1>
        <p className="text-muted-foreground max-w-lg mx-auto">xbags makes it simple to create, connect, and earn in the Web3 ecosystem.</p>
      </div>
      <div className="space-y-6">
        {steps.map((step, i) => (
          <motion.div key={step.title} initial={{ opacity: 0, x: i % 2 === 0 ? -30 : 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="flex gap-5 p-6 rounded-xl bg-card border border-border shadow-card">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <step.icon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1"><span className="text-xs font-bold text-primary">Step {i + 1}</span></div>
              <h3 className="font-semibold text-foreground mb-1">{step.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default HowItWorksPage;
