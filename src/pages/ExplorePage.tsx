import { motion } from "framer-motion";
import { Search, TrendingUp, Flame } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const trending = ["#Web3Art", "#SolanaCreators", "#NFTDrop", "#BuildInPublic", "#CreatorEconomy"];

const creators = [
  { name: "Luna Waves", handle: "@lunawaves", followers: "45.2K", category: "Digital Art", color: "bg-secondary/20 text-secondary" },
  { name: "Block Builder", handle: "@blockbuilder", followers: "32.1K", category: "Dev", color: "bg-primary/20 text-primary" },
  { name: "Melody Chain", handle: "@melodychain", followers: "28.7K", category: "Music", color: "bg-warning/20 text-warning" },
  { name: "Pixel Prime", handle: "@pixelprime", followers: "21.4K", category: "Gaming", color: "bg-destructive/20 text-destructive" },
  { name: "Data Sage", handle: "@datasage", followers: "19.8K", category: "Analytics", color: "bg-success/20 text-success" },
  { name: "Crypto Canvas", handle: "@cryptocanvas", followers: "17.3K", category: "Art", color: "bg-secondary/20 text-secondary" },
];

const ExplorePage = () => {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">Explore</h1>

      <div className="relative mb-8">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search creators, posts, tags..." className="pl-10 bg-card border-border" />
      </div>

      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Flame className="h-5 w-5 text-warning" />
          <h2 className="font-semibold">Trending</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {trending.map((tag) => (
            <Badge key={tag} variant="secondary" className="bg-muted text-foreground hover:bg-primary/10 hover:text-primary cursor-pointer">
              {tag}
            </Badge>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Top Creators</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {creators.map((c, i) => (
            <motion.div
              key={c.handle}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="p-4 rounded-xl bg-card border border-border shadow-card hover:border-primary/30 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold ${c.color}`}>
                  {c.name.split(" ").map(w => w[0]).join("")}
                </div>
                <div>
                  <div className="font-semibold text-sm">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.handle}</div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{c.followers} followers</span>
                <Badge variant="outline" className="text-[10px] border-border">{c.category}</Badge>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ExplorePage;
