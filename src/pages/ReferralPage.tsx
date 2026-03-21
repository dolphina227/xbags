import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Gift, Copy, Check, Users, Star, Twitter, Send,
  Heart, Repeat2, ChevronRight, Zap, Trophy
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-profile";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ReferralStats {
  code: string;
  total_referrals: number;
  total_points: number;
}

interface Quest {
  id: string;
  title: string;
  description: string;
  points: number;
  icon: React.ReactNode;
  action_url?: string;
  action_label: string;
  completed: boolean;
  type: "social" | "platform";
}

interface LeaderboardEntry {
  rank: number;
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  total_points: number;
  total_referrals: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function generateCode(username: string): string {
  const base = (username || "user").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  const suffix = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${base}${suffix}`;
}

const QUESTS: Omit<Quest, "completed">[] = [
  {
    id: "follow_x",
    title: "Follow xBAGS on X",
    description: "Follow our official X account to stay updated",
    points: 1000,
    icon: <Twitter className="h-5 w-5" />,
    action_url: "https://x.com/xbagsocial",
    action_label: "Follow on X",
    type: "social",
  },
  {
    id: "join_telegram",
    title: "Join Telegram",
    description: "Join the xBAGS Telegram community",
    points: 1000,
    icon: <Send className="h-5 w-5" />,
    action_url: "https://t.me/xbagsocial",
    action_label: "Join Telegram",
    type: "social",
  },
  {
    id: "like_post",
    title: "Like a Post",
    description: "Like any post on xBAGS feed",
    points: 1000,
    icon: <Heart className="h-5 w-5" />,
    action_label: "Like a Post",
    type: "platform",
  },
  {
    id: "repost",
    title: "Repost Something",
    description: "Repost any post on xBAGS feed",
    points: 1000,
    icon: <Repeat2 className="h-5 w-5" />,
    action_label: "Go to Feed",
    type: "platform",
  },
];

// ─── Main Component ───────────────────────────────────────────────────────────
const ReferralPage = () => {
  const { profile } = useProfile();
  const navigate = useNavigate();
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [completedQuests, setCompletedQuests] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [claimingQuest, setClaimingQuest] = useState<string | null>(null);

  const referralLink = stats?.code
    ? `${window.location.origin}/?ref=${stats.code}`
    : null;

  // ── Fetch referral data ──
  const fetchData = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      // Fetch referral code + stats
      const { data: ref } = await supabase
        .from("referrals" as any)
        .select("code, total_referrals, total_points")
        .eq("user_id", profile.id)
        .maybeSingle();

      if (ref) setStats(ref as ReferralStats);

      // Fetch completed quests
      const { data: quests } = await supabase
        .from("quest_completions" as any)
        .select("quest_id")
        .eq("user_id", profile.id);

      if (quests) {
        setCompletedQuests(new Set((quests as any[]).map((q) => q.quest_id)));
      }
    } catch {
      // Tables might not exist yet — silent
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  const fetchLeaderboard = useCallback(async () => {
    setLeaderboardLoading(true);
    try {
      const { data } = await supabase
        .from("referrals" as any)
        .select("user_id, total_points, total_referrals")
        .order("total_points", { ascending: false })
        .limit(20);

      if (!data || data.length === 0) { setLeaderboard([]); return; }

      // Fetch profile info untuk semua user
      const userIds = (data as any[]).map((r) => r.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", userIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

      const entries: LeaderboardEntry[] = (data as any[]).map((r, i) => {
        const p = profileMap.get(r.user_id) as any;
        return {
          rank: i + 1,
          user_id: r.user_id,
          username: p?.username || null,
          display_name: p?.display_name || null,
          avatar_url: p?.avatar_url || null,
          total_points: r.total_points || 0,
          total_referrals: r.total_referrals || 0,
        };
      });

      setLeaderboard(entries);
    } catch {
      // silent
    } finally {
      setLeaderboardLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Generate referral code ──
  const handleGenerate = async () => {
    if (!profile?.id || generating) return;
    setGenerating(true);
    try {
      const code = generateCode(profile.username || profile.display_name || "USER");
      const { data, error } = await supabase
        .from("referrals" as any)
        .upsert({
          user_id: profile.id,
          code,
          total_referrals: 0,
          total_points: 0,
        }, { onConflict: "user_id" })
        .select()
        .single();

      if (error) throw error;
      setStats(data as ReferralStats);
      toast.success("Referral link generated!");
    } catch {
      toast.error("Failed to generate referral link");
    } finally {
      setGenerating(false);
    }
  };

  // ── Copy link ──
  const handleCopy = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success("Referral link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Claim quest ──
  const handleClaimQuest = async (questId: string, points: number, actionUrl?: string) => {
    if (!profile?.id || completedQuests.has(questId)) return;

    // For social quests, open URL first
    if (actionUrl) window.open(actionUrl, "_blank");

    setClaimingQuest(questId);
    try {
      // Insert quest completion
      const { error } = await supabase
        .from("quest_completions" as any)
        .insert({ user_id: profile.id, quest_id: questId, points_earned: points });

      if (error?.code === "23505") {
        toast.info("Quest already completed!");
        setCompletedQuests(prev => new Set([...prev, questId]));
        return;
      }
      if (error) throw error;

      // Update total points in referrals
      await supabase
        .from("referrals" as any)
        .upsert({
          user_id: profile.id,
          code: stats?.code || generateCode(profile.username || "USER"),
          total_referrals: stats?.total_referrals || 0,
          total_points: (stats?.total_points || 0) + points,
        }, { onConflict: "user_id" });

      setCompletedQuests(prev => new Set([...prev, questId]));
      setStats(prev => prev ? { ...prev, total_points: (prev.total_points || 0) + points } : prev);
      toast.success(`+${points.toLocaleString()} xBAGS Points earned!`);
    } catch {
      toast.error("Failed to claim quest. Try again.");
    } finally {
      setClaimingQuest(null);
    }
  };

  const quests: Quest[] = QUESTS.map(q => ({
    ...q,
    completed: completedQuests.has(q.id),
  }));

  // total_points di DB sudah include quest + referral points — tidak perlu hitung ulang
  const totalPoints = stats?.total_points || 0;
  const questPoints = completedQuests.size * 1000;
  const referralPoints = (stats?.total_referrals || 0) * 5000;

  return (
    <div className="container mx-auto max-w-2xl px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Referral & Quests</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Earn xBAGS Points — converted to $XBAGS tokens at launch
          </p>
        </div>
        <button
          onClick={() => navigate("/leaderboard")}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted/40 border border-border hover:border-warning/40 hover:bg-muted transition-colors text-xs font-semibold text-muted-foreground hover:text-foreground shrink-0"
        >
          <Trophy className="h-4 w-4 text-warning" />
          <span className="hidden sm:inline">Leaderboard</span>
        </button>
      </div>

      {/* Total Points Banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-5 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/5 to-transparent border border-primary/30"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <Trophy className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total xBAGS Points</p>
            <p className="text-3xl font-bold text-primary">{totalPoints.toLocaleString()}</p>
          </div>
        </div>
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Zap className="h-3 w-3 text-primary" />
            {questPoints.toLocaleString()} from quests
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3 text-primary" />
            {referralPoints.toLocaleString()} from referrals
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground mt-3 border-t border-border pt-2">
          All points will be converted to $XBAGS tokens at TGE
        </p>
      </motion.div>

      {/* Referral Section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="p-5 rounded-2xl bg-card border border-border space-y-4"
      >
        <div className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-primary" />
          <h2 className="text-base font-bold">Your Referral Link</h2>
        </div>

        <div className="flex gap-3 text-sm">
          <div className="flex-1 p-3 rounded-xl bg-muted/30 border border-border text-center">
            <p className="text-2xl font-bold text-foreground">{stats?.total_referrals || 0}</p>
            <p className="text-xs text-muted-foreground">Friends Referred</p>
          </div>
          <div className="flex-1 p-3 rounded-xl bg-primary/10 border border-primary/20 text-center">
            <p className="text-2xl font-bold text-primary">{referralPoints.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Points Earned</p>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-muted/20 border border-border text-xs text-muted-foreground">
          <Star className="h-3.5 w-3.5 text-primary inline mr-1" />
          Every friend who joins with your link gives you <span className="text-primary font-semibold">+5,000 xBAGS Points</span>
        </div>

        {stats?.code ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Your referral link:</p>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/30 border border-border">
              <code className="flex-1 text-xs text-foreground truncate">{referralLink}</code>
              <button
                onClick={handleCopy}
                className="h-8 w-8 rounded-lg flex items-center justify-center bg-primary/10 hover:bg-primary/20 transition-colors shrink-0"
              >
                {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4 text-primary" />}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={handleGenerate}
            disabled={generating || loading}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {generating ? "Generating..." : "Generate My Referral Link"}
          </button>
        )}
      </motion.div>

      {/* Quests Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <h2 className="text-base font-bold">Quests</h2>
          </div>
          <span className="text-xs text-muted-foreground">
            {completedQuests.size}/{QUESTS.length} completed
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-muted rounded-full mb-4 overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${(completedQuests.size / QUESTS.length) * 100}%` }}
            transition={{ duration: 0.5, delay: 0.2 }}
          />
        </div>

        <div className="space-y-3">
          {quests.map((quest, i) => (
            <motion.div
              key={quest.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              className={`flex items-center gap-4 p-4 rounded-xl border transition-colors ${
                quest.completed
                  ? "bg-primary/5 border-primary/20"
                  : "bg-card border-border hover:border-primary/30"
              }`}
            >
              {/* Icon */}
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                quest.completed ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
              }`}>
                {quest.completed ? <Check className="h-5 w-5" /> : quest.icon}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${quest.completed ? "text-muted-foreground line-through" : "text-foreground"}`}>
                  {quest.title}
                </p>
                <p className="text-xs text-muted-foreground">{quest.description}</p>
              </div>

              {/* Points + Action */}
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <span className="text-xs font-bold text-primary">+{quest.points.toLocaleString()}</span>
                {quest.completed ? (
                  <span className="text-[10px] text-primary font-medium">✓ Done</span>
                ) : (
                  <button
                    onClick={() => handleClaimQuest(quest.id, quest.points, quest.action_url)}
                    disabled={claimingQuest === quest.id}
                    className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                  >
                    {claimingQuest === quest.id ? "..." : quest.action_label}
                    <ChevronRight className="h-3 w-3" />
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Info Footer */}
      <div className="p-4 rounded-xl bg-muted/20 border border-border text-xs text-muted-foreground space-y-1">
        <p className="font-semibold text-foreground">How it works</p>
        <p>• Complete quests to earn xBAGS Points</p>
        <p>• Share your referral link — earn 5,000 points per friend</p>
        <p>• All points convert to $XBAGS tokens at Token Generation Event (TGE)</p>
        <p>• More ways to earn points coming soon</p>
      </div>
    </div>
  );
};

export default ReferralPage;