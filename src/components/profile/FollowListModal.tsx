import { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface Profile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

interface FollowListModalProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  type: "followers" | "following";
}

export default function FollowListModal({ open, onClose, userId, type }: FollowListModalProps) {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !userId) return;
    setLoading(true);
    const fetchList = async () => {
      try {
        if (type === "followers") {
          const { data } = await supabase
            .from("follows")
            .select("follower_id")
            .eq("following_id", userId);
          const ids = (data || []).map((f: any) => f.follower_id);
          if (ids.length > 0) {
            const { data: profiles } = await supabase
              .from("profiles")
              .select("id, username, display_name, avatar_url")
              .in("id", ids);
            setProfiles(profiles || []);
          } else {
            setProfiles([]);
          }
        } else {
          const { data } = await supabase
            .from("follows")
            .select("following_id")
            .eq("follower_id", userId);
          const ids = (data || []).map((f: any) => f.following_id);
          if (ids.length > 0) {
            const { data: profiles } = await supabase
              .from("profiles")
              .select("id, username, display_name, avatar_url")
              .in("id", ids);
            setProfiles(profiles || []);
          } else {
            setProfiles([]);
          }
        }
      } catch {
        setProfiles([]);
      } finally {
        setLoading(false);
      }
    };
    fetchList();
  }, [open, userId, type]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-modal overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h2 className="font-bold text-foreground capitalize">{type}</h2>
              <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : profiles.length === 0 ? (
                <p className="text-center py-12 text-sm text-muted-foreground">
                  No {type} yet
                </p>
              ) : (
                profiles.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { navigate(`/profile/${p.username || p.id}`); onClose(); }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                  >
                    <Avatar className="h-10 w-10 shrink-0">
                      {p.avatar_url ? <AvatarImage src={p.avatar_url} /> : null}
                      <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
                        {(p.display_name || p.username || "?")[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground truncate">
                        {p.display_name || p.username || "Anonymous"}
                      </div>
                      {p.username && <div className="text-xs text-muted-foreground">@{p.username}</div>}
                    </div>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
