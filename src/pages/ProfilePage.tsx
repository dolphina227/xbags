import { motion } from "framer-motion";
import { MapPin, Link as LinkIcon, Calendar, Edit, Camera, Loader2, UserPlus, UserMinus, MessageCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useParams, useNavigate } from "react-router-dom";
import { useProfile } from "@/hooks/use-profile";
import { useWallet } from "@/hooks/use-wallet";
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { feedAPI } from "@/lib/api/feed";
import type { Profile } from "@/hooks/use-profile";
import type { Post } from "@/lib/api/feed";
import PostCard from "@/components/feed/PostCard";
import PostSkeleton from "@/components/feed/PostSkeleton";
import { toast } from "sonner";
import { useMessages } from "@/hooks/use-messages";
import FollowListModal from "@/components/profile/FollowListModal";

const ProfilePage = () => {
  const { username } = useParams();
  const navigate = useNavigate();
  const { profile: myProfile, setShowSetupModal, uploadAvatar, updateProfile } = useProfile();
  const { address } = useWallet();
  const { startConversation } = useMessages();
  const [viewProfile, setViewProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [likedPosts, setLikedPosts] = useState<Post[]>([]);
  const [replies, setReplies] = useState<any[]>([]);
  const [mediaPosts, setMediaPosts] = useState<Post[]>([]);
  const [scheduledPosts, setScheduledPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [likesLoading, setLikesLoading] = useState(false);
  const [repliesLoading, setRepliesLoading] = useState(false);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [scheduledLoading, setScheduledLoading] = useState(false);
  const [postsCount, setPostsCount] = useState(0);
  const [activeTab, setActiveTab] = useState("posts");
  const [bannerUploading, setBannerUploading] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // Follow state
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followListType, setFollowListType] = useState<"followers" | "following">("followers");
  const [followListOpen, setFollowListOpen] = useState(false);

  const isOwnProfile = !username || username === "me" || username === myProfile?.username;

  useEffect(() => {
    if (isOwnProfile) {
      setViewProfile(myProfile);
    } else if (username) {
      setIsLoading(true);
      supabase
        .from("profiles")
        .select("*")
        .ilike("username", username)
        .maybeSingle()
        .then(({ data }) => {
          setViewProfile(data as any);
          setIsLoading(false);
        });
    }
  }, [username, myProfile, isOwnProfile]);

  // Load follow counts and check if following
  useEffect(() => {
    if (!viewProfile?.id) return;
    feedAPI.getFollowCounts(viewProfile.id).then(({ followers, following }) => {
      setFollowersCount(followers);
      setFollowingCount(following);
    });
    if (myProfile?.id && !isOwnProfile) {
      feedAPI.isFollowing(myProfile.id, viewProfile.id).then(setIsFollowing);
    }
  }, [viewProfile?.id, myProfile?.id, isOwnProfile]);

  // Load posts
  useEffect(() => {
    if (!viewProfile?.id) return;
    setPostsLoading(true);
    Promise.all([
      feedAPI.getUserPosts(viewProfile.id),
      supabase.from("posts").select("id", { count: "exact" }).eq("user_id", viewProfile.id).eq("is_published", true),
    ]).then(([userPosts, countRes]) => {
      setPosts(userPosts);
      setPostsCount(countRes.count || 0);
      setPostsLoading(false);
    }).catch(() => setPostsLoading(false));
  }, [viewProfile?.id]);

  // Load likes when tab is active
  useEffect(() => {
    if (activeTab !== "likes" || !viewProfile?.id) return;
    setLikesLoading(true);
    feedAPI.getUserLikedPosts(viewProfile.id).then(setLikedPosts).catch(() => {}).finally(() => setLikesLoading(false));
  }, [activeTab, viewProfile?.id]);

  // Load replies when tab is active
  useEffect(() => {
    if (activeTab !== "replies" || !viewProfile?.id) return;
    setRepliesLoading(true);
    feedAPI.getUserReplies(viewProfile.id).then(setReplies).catch(() => {}).finally(() => setRepliesLoading(false));
  }, [activeTab, viewProfile?.id]);

  // Load media when tab is active
  useEffect(() => {
    if (activeTab !== "media" || !viewProfile?.id) return;
    setMediaLoading(true);
    feedAPI.getUserMediaPosts(viewProfile.id).then(setMediaPosts).catch(() => {}).finally(() => setMediaLoading(false));
  }, [activeTab, viewProfile?.id]);

  // Load scheduled posts when tab is active (only own profile)
  useEffect(() => {
    if (activeTab !== "scheduled" || !viewProfile?.id || !isOwnProfile) return;
    setScheduledLoading(true);
    feedAPI.getUserScheduledPosts(viewProfile.id).then(setScheduledPosts).catch(() => {}).finally(() => setScheduledLoading(false));
  }, [activeTab, viewProfile?.id, isOwnProfile]);

  const handlePostUpdate = useCallback((postId: string, updates: Partial<Post>) => {
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, ...updates } : p));
    setLikedPosts(prev => prev.map(p => p.id === postId ? { ...p, ...updates } : p));
    setMediaPosts(prev => prev.map(p => p.id === postId ? { ...p, ...updates } : p));
    setScheduledPosts(prev => prev.map(p => p.id === postId ? { ...p, ...updates } : p));
  }, []);

  const handlePostDelete = useCallback((postId: string) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
    setLikedPosts(prev => prev.filter(p => p.id !== postId));
    setMediaPosts(prev => prev.filter(p => p.id !== postId));
    setScheduledPosts(prev => prev.filter(p => p.id !== postId));
    setPostsCount(c => c - 1);
  }, []);

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !address) return;
    if (file.size > 5 * 1024 * 1024) return;
    setBannerUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `banners/${address}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      await supabase.from("profiles").update({ banner_url: urlData.publicUrl } as any).eq("wallet_address", address);
      setViewProfile(prev => prev ? { ...prev, banner_url: urlData.publicUrl } as any : prev);
    } catch {
      // silent fail
    } finally {
      setBannerUploading(false);
    }
  };

  const handleFollow = async () => {
    if (!myProfile?.id || !viewProfile?.id) return toast.error("Connect wallet first");
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await feedAPI.unfollowUser(myProfile.id, viewProfile.id);
        setIsFollowing(false);
        setFollowersCount(c => Math.max(0, c - 1));
        toast.success("Unfollowed");
      } else {
        await feedAPI.followUser(myProfile.id, viewProfile.id);
        setIsFollowing(true);
        setFollowersCount(c => c + 1);
        toast.success("Followed!");
      }
    } catch {
      toast.error("Failed");
    } finally {
      setFollowLoading(false);
    }
  };

  const profile = viewProfile;
  const bannerUrl = (profile as any)?.banner_url;

  return (
    <div className="container mx-auto max-w-3xl px-4 py-6">
      {/* Banner */}
      <div
        className="h-32 sm:h-48 rounded-xl mb-[-40px] relative overflow-hidden group"
        style={bannerUrl ? { backgroundImage: `url(${bannerUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
      >
        {!bannerUrl && <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-primary/5 to-primary/20" />}
        {isOwnProfile && (
          <>
            <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={handleBannerUpload} />
            <button
              onClick={() => bannerInputRef.current?.click()}
              className="absolute inset-0 flex items-center justify-center bg-background/40 opacity-0 group-hover:opacity-100 transition-opacity"
              disabled={bannerUploading}
            >
              {bannerUploading ? <Loader2 className="h-6 w-6 animate-spin text-foreground" /> : <Camera className="h-6 w-6 text-foreground" />}
            </button>
          </>
        )}
      </div>

      <div className="relative z-10 px-4">
        <Avatar className="h-20 w-20 border-4 border-background">
          {profile?.avatar_url ? (
            <AvatarImage src={profile.avatar_url} alt={profile.display_name || ""} />
          ) : null}
          <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
            {profile?.display_name?.[0]?.toUpperCase() || "?"}
          </AvatarFallback>
        </Avatar>
        <div className="mt-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">{profile?.display_name || "Unknown User"}</h1>
            <p className="text-sm text-muted-foreground">@{profile?.username || "—"}</p>
            {profile?.bio && <p className="text-sm text-foreground mt-2 max-w-md">{profile.bio}</p>}
            <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-muted-foreground">
              {profile?.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {profile.location}</span>}
              {profile?.website && <span className="flex items-center gap-1"><LinkIcon className="h-3 w-3" /> <a href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">{profile.website}</a></span>}
              <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Joined {profile?.created_at ? new Date(profile.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "—"}</span>
            </div>
          </div>
          {isOwnProfile ? (
            <Button variant="outline" size="sm" className="gap-2 border-border self-start hover:border-primary" onClick={() => setShowSetupModal(true)}>
              <Edit className="h-3.5 w-3.5" /> Edit Profile
            </Button>
          ) : (
            <div className="flex gap-2 self-start">
              <Button
                variant={isFollowing ? "outline" : "default"}
                size="sm"
                className="gap-2"
                onClick={handleFollow}
                disabled={followLoading}
              >
                {followLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : isFollowing ? (
                  <><UserMinus className="h-3.5 w-3.5" /> Unfollow</>
                ) : (
                  <><UserPlus className="h-3.5 w-3.5" /> Follow</>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-border hover:border-primary"
                onClick={async () => {
                  if (!myProfile?.id || !viewProfile?.id) {
                    toast.error("Connect wallet first");
                    return;
                  }
                  try {
                    await startConversation(viewProfile.id);
                    navigate("/messages");
                  } catch {
                    toast.error("Failed to start conversation");
                  }
                }}
              >
                <MessageCircle className="h-3.5 w-3.5" /> Message
              </Button>
            </div>
          )}
        </div>
        <div className="flex gap-6 mt-6">
          <div><span className="font-bold text-foreground">{postsCount}</span> <span className="text-sm text-muted-foreground">Posts</span></div>
          <button onClick={() => { setFollowListType("followers"); setFollowListOpen(true); }} className="hover:underline">
            <span className="font-bold text-foreground">{followersCount}</span> <span className="text-sm text-muted-foreground">Followers</span>
          </button>
          <button onClick={() => { setFollowListType("following"); setFollowListOpen(true); }} className="hover:underline">
            <span className="font-bold text-foreground">{followingCount}</span> <span className="text-sm text-muted-foreground">Following</span>
          </button>
        </div>

        {viewProfile?.id && (
          <FollowListModal
            open={followListOpen}
            onClose={() => setFollowListOpen(false)}
            userId={viewProfile.id}
            type={followListType}
          />
        )}
        <div className="flex flex-wrap gap-2 mt-4">
          <Badge className="bg-primary/10 text-primary border-primary/20">OG Creator</Badge>
        </div>
      </div>

      {/* Posts Section with Tabs */}
      <div className="mt-8">
        <Tabs defaultValue="posts" className="w-full" onValueChange={setActiveTab}>
          <TabsList className={`grid w-full bg-card border border-border ${isOwnProfile ? "grid-cols-5" : "grid-cols-4"}`}>
            <TabsTrigger value="posts" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground">Posts</TabsTrigger>
            <TabsTrigger value="likes" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground">Likes</TabsTrigger>
            <TabsTrigger value="replies" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground">Replies</TabsTrigger>
            <TabsTrigger value="media" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground">Media</TabsTrigger>
            {isOwnProfile && (
              <TabsTrigger value="scheduled" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />Sched
              </TabsTrigger>
            )}
          </TabsList>

          {/* Posts Tab */}
          <TabsContent value="posts" className="mt-4 space-y-0">
            {isLoading || postsLoading ? (
              [1, 2, 3].map((_, i) => <PostSkeleton key={i} />)
            ) : posts.length > 0 ? (
              posts.map((post, i) => (
                <PostCard key={post.id} post={post} onUpdate={handlePostUpdate} onDelete={handlePostDelete} index={i} />
              ))
            ) : (
              <div className="text-center py-12 text-muted-foreground text-sm">No posts yet</div>
            )}
          </TabsContent>

          {/* Likes Tab */}
          <TabsContent value="likes" className="mt-4 space-y-0">
            {likesLoading ? (
              [1, 2, 3].map((_, i) => <PostSkeleton key={i} />)
            ) : likedPosts.length > 0 ? (
              likedPosts.map((post, i) => (
                <PostCard key={post.id} post={post} onUpdate={handlePostUpdate} onDelete={handlePostDelete} index={i} />
              ))
            ) : (
              <div className="text-center py-12 text-muted-foreground text-sm">No liked posts yet</div>
            )}
          </TabsContent>

          {/* Replies Tab */}
          <TabsContent value="replies" className="mt-4 space-y-0">
            {repliesLoading ? (
              [1, 2, 3].map((_, i) => <PostSkeleton key={i} />)
            ) : replies.length > 0 ? (
              replies.map((reply: any) => (
                <div key={reply.id} className="px-4 py-3 border-b border-border hover:bg-muted/30 transition-colors">
                  <div className="flex gap-2 items-start">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={reply.author?.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                        {(reply.author?.display_name || "?")[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-foreground">{reply.author?.display_name || "You"}</span>
                        <span className="text-xs text-muted-foreground">@{reply.author?.username || ""}</span>
                        <span className="text-xs text-muted-foreground">· {new Date(reply.created_at).toLocaleDateString()}</span>
                      </div>
                      {reply.post && (
                        <p
                          className="text-xs text-muted-foreground mt-0.5 cursor-pointer hover:underline"
                          onClick={() => navigate(`/post/${reply.post_id}`)}
                        >
                          Replying to @{reply.post?.author?.username || "unknown"}
                        </p>
                      )}
                      <p className="text-sm text-foreground mt-1">{reply.content}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-muted-foreground text-sm">No replies yet</div>
            )}
          </TabsContent>

          {/* Media Tab */}
          <TabsContent value="media" className="mt-4">
            {mediaLoading ? (
              [1, 2, 3].map((_, i) => <PostSkeleton key={i} />)
            ) : mediaPosts.length > 0 ? (
              <div className="grid grid-cols-3 gap-1">
                {mediaPosts.flatMap((post) =>
                  (post.media_urls || []).map((url, i) => (
                    <div
                      key={`${post.id}-${i}`}
                      className="aspect-square overflow-hidden rounded cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => navigate(`/post/${post.id}`)}
                    >
                      {post.media_type === "video" ? (
                        <video src={url} className="w-full h-full object-cover" />
                      ) : (
                        <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
                      )}
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground text-sm">No media yet</div>
            )}
          </TabsContent>

          {/* Scheduled Tab — hanya tampil untuk profil sendiri */}
          {isOwnProfile && (
            <TabsContent value="scheduled" className="mt-4 space-y-0">
              {scheduledLoading ? (
                [1, 2, 3].map((_, i) => <PostSkeleton key={i} />)
              ) : scheduledPosts.length > 0 ? (
                scheduledPosts.map((post, i) => (
                  <div key={post.id}>
                    <div className="flex items-center gap-1.5 px-4 pt-3 pb-1">
                      <div className="flex items-center gap-1 bg-primary/10 text-primary border border-primary/20 rounded-full px-2 py-0.5 text-[10px] font-semibold">
                        <Clock className="h-3 w-3" />
                        {post.scheduled_at
                          ? new Date(post.scheduled_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                          : "Scheduled"}
                      </div>
                    </div>
                    <PostCard post={post} onUpdate={handlePostUpdate} onDelete={handlePostDelete} index={i} />
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  No scheduled posts
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
};

export default ProfilePage;