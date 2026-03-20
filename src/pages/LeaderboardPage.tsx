import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Trophy, Users, Zap, RefreshCw, Crown, Medal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-profile";
import { useNavigate } from "react-router-dom";

interface LeaderboardEntry {
  rank: number;
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  total_points: number;
  total_referrals: number;
}

export default function LeaderboardPage() {
  const { profile } = useProfile();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [myRank, setMyRank] = useState<LeaderboardEntry | null>(null);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("referrals" as any)
        .select("user_id, total_points, total_referrals")
        .order("total_points", { ascending: false })
        .limit(50);

      if (!data || data.length === 0) { setEntries([]); return; }

      const userIds = (data as any[]).map((r) => r.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", userIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

      const list: LeaderboardEntry[] = (data as any[]).map((r, i) => {
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

      setEntries(list);
      if (profile?.id) setMyRank(list.find((e) => e.user_id === profile.id) || null);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => { fetchLeaderboard(); }, [fetchLeaderboard]);

  const rankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="h-4 w-4 text-yellow-400" />;
    if (rank === 2) return <Medal className="h-4 w-4 text-slate-300" />;
    if (rank === 3) return <Medal className="h-4 w-4 text-amber-600" />;
    return <span className="text-xs font-bold text-muted-foreground">{rank}</span>;
  };

  const rankRowStyle = (rank: number, isMe: boolean) => {
    if (isMe) return "border-primary/30 bg-primary/5";
    if (rank === 1) return "border-yellow-400/20 bg-yellow-400/5";
    if (rank === 2) return "border-slate-300/20 bg-slate-300/5";
    if (rank === 3) return "border-amber-600/20 bg-amber-600/5";
    return "border-border bg-card/30";
  };

  return (
    <div className="container mx-auto max-w-2xl px-4 py-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leaderboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Top xBAGS Points earners</p>
        </div>
        <button
          onClick={fetchLeaderboard}
          disabled={loading}
          className="h-9 w-9 flex items-center justify-center rounded-full border border-border hover:bg-muted transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* My Rank Banner */}
      {myRank && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-4 rounded-2xl bg-primary/10 border border-primary/25"
        >
          <div className="h-9 w-9 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
            <Zap className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">Your ranking</p>
            <p className="text-sm font-bold text-foreground">
              #{myRank.rank} — {myRank.total_points.toLocaleString()} pts · {myRank.total_referrals} referral{myRank.total_referrals !== 1 ? "s" : ""}
            </p>
          </div>
          <button onClick={() => navigate("/referral")} className="text-xs font-semibold text-primary hover:underline shrink-0">
            Earn more →
          </button>
        </motion.div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16">
          <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-30" />
          <p className="text-base font-semibold text-foreground">No entries yet</p>
          <p className="text-sm text-muted-foreground mt-1">Be the first to earn xBAGS Points!</p>
          <button onClick={() => navigate("/referral")}
            className="mt-4 px-5 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
            Start Earning
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-border overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-muted/40 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <div className="col-span-1 text-center">#</div>
            <div className="col-span-5">User</div>
            <div className="col-span-3 text-center">Referrals</div>
            <div className="col-span-3 text-right">Points</div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-border">
            {entries.map((entry, i) => {
              const isMe = entry.user_id === profile?.id;
              return (
                <motion.div
                  key={entry.user_id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  onClick={() => entry.username && navigate(`/profile/${entry.username}`)}
                  className={`grid grid-cols-12 gap-2 px-4 py-3 items-center cursor-pointer transition-colors hover:bg-muted/30 ${rankRowStyle(entry.rank, isMe)}`}
                >
                  {/* Rank */}
                  <div className="col-span-1 flex justify-center">
                    {rankIcon(entry.rank)}
                  </div>

                  {/* User */}
                  <div className="col-span-5 flex items-center gap-2.5 min-w-0">
                    <div className="h-9 w-9 rounded-full overflow-hidden bg-muted border border-border shrink-0">
                      {entry.avatar_url ? (
                        <img src={entry.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center bg-primary/20 text-primary text-sm font-bold">
                          {(entry.display_name || entry.username || "?")[0].toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-foreground truncate">
                          {entry.display_name || entry.username || "Anonymous"}
                        </span>
                        {isMe && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/20 text-primary shrink-0">You</span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground truncate block">
                        @{entry.username || "unknown"}
                      </span>
                    </div>
                  </div>

                  {/* Referrals */}
                  <div className="col-span-3 flex items-center justify-center gap-1 text-sm text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    <span className="font-medium">{entry.total_referrals}</span>
                  </div>

                  {/* Points */}
                  <div className="col-span-3 text-right">
                    <span className={`text-sm font-bold ${
                      entry.rank === 1 ? "text-yellow-400" :
                      entry.rank === 2 ? "text-slate-300" :
                      entry.rank === 3 ? "text-amber-600" :
                      isMe ? "text-primary" : "text-foreground"
                    }`}>
                      {entry.total_points.toLocaleString()}
                    </span>
                    <span className="text-xs text-muted-foreground ml-1">pts</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {entries.length > 0 && (
        <p className="text-xs text-muted-foreground text-center pb-2">
          Points convert to $XBAGS tokens at TGE ·{" "}
          <button onClick={() => navigate("/referral")} className="text-primary hover:underline">
            Earn more points →
          </button>
        </p>
      )}
    </div>
  );
}