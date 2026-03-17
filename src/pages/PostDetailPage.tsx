import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import PostCard from "@/components/feed/PostCard";
import { feedAPI, Post } from "@/lib/api/feed";
import { useProfile } from "@/hooks/use-profile";

export default function PostDetailPage() {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const { profile } = useProfile();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!postId) return;
    setLoading(true);
    feedAPI.getPost(postId, profile?.id).then(setPost).catch(() => setPost(null)).finally(() => setLoading(false));
  }, [postId, profile?.id]);

  const handleUpdate = (id: string, updates: Partial<Post>) => {
    setPost((prev) => (prev && prev.id === id ? { ...prev, ...updates } : prev));
  };

  const handleDelete = () => {
    navigate("/");
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border sticky top-0 bg-background/80 backdrop-blur-sm z-10">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-lg font-bold text-foreground">Post</h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : post ? (
        <PostCard post={post} onUpdate={handleUpdate} onDelete={handleDelete} index={0} />
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-lg font-semibold text-foreground mb-1">Post not found</p>
          <p className="text-sm text-muted-foreground">It may have been deleted.</p>
        </div>
      )}
    </div>
  );
}
