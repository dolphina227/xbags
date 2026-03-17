import { motion } from "framer-motion";
import { Trophy, Medal, Crown, TrendingUp } from "lucide-react";

const leaders = [
  { rank: 1, name: "Luna Waves", handle: "@lunawaves", points: "12,450", icon: Crown, color: "text-warning" },
  { rank: 2, name: "Block Builder", handle: "@blockbuilder", points: "11,230", icon: Medal, color: "text-muted-foreground" },
  { rank: 3, name: "Melody Chain", handle: "@melodychain", points: "10,890", icon: Medal, color: "text-warning/70" },
  { rank: 4, name: "Pixel Prime", handle: "@pixelprime", points: "9,780" },
  { rank: 5, name: "Data Sage", handle: "@datasage", points: "8,920" },
  { rank: 6, name: "Crypto Canvas", handle: "@cryptocanvas", points: "8,450" },
  { rank: 7, name: "Art Nova", handle: "@artnova", points: "7,890" },
  { rank: 8, name: "Chain Poet", handle: "@chainpoet", points: "7,230" },
];

const LeaderboardPage = () => {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-6">
      <div className="flex items-center gap-2 mb-6">
        <Trophy className="h-6 w-6 text-warning" />
        <h1 className="text-2xl font-bold">Leaderboard</h1>
      </div>

      <div className="space-y-2">
        {leaders.map((l, i) => (
          <motion.div
            key={l.rank}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`flex items-center gap-4 p-4 rounded-xl border transition-colors cursor-pointer ${
              l.rank <= 3
                ? "bg-card border-primary/20 shadow-card"
                : "bg-card border-border hover:border-primary/20"
            }`}
          >
            <div className="w-8 text-center font-bold text-lg text-muted-foreground">
              {l.icon ? <l.icon className={`h-6 w-6 mx-auto ${l.color}`} /> : `#${l.rank}`}
            </div>
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
              {l.name.split(" ").map(w => w[0]).join("")}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">{l.name}</div>
              <div className="text-xs text-muted-foreground">{l.handle}</div>
            </div>
            <div className="flex items-center gap-1 text-sm font-semibold text-primary">
              <TrendingUp className="h-3.5 w-3.5" />
              {l.points}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default LeaderboardPage;
