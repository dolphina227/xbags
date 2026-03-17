'use client';

import { useState } from 'react';
import { useWallet } from '@/hooks/use-wallet';
import { useProfile } from '@/hooks/use-profile';
import { feedAPI, type Post } from '@/lib/api/feed';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface QuoteModalProps {
  post: Post;
  onClose: () => void;
  onQuote: () => void;
}

export function QuoteModal({ post, onClose, onQuote }: QuoteModalProps) {
  const { status } = useWallet();
  const { profile } = useProfile();
  const [content, setContent] = useState('');
  const isConnected = status === 'connected';
  const [loading, setLoading] = useState(false);

  async function handleQuote() {
    if (!profile?.id) return;

    try {
      setLoading(true);
      await feedAPI.quoteRetweet(post.id, profile.id, content.trim() || "");
      toast.success('Quote tweet posted!');
      onQuote();
      onClose();
    } catch (error) {
      toast.error('Failed to post quote tweet');
      console.error('Quote error:', error);
    } finally {
      setLoading(false);
    }
  }

  if (!isConnected || !profile) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
        <div className="bg-[#111111] border border-[#1A1A1A] rounded-2xl w-full max-w-md p-6 text-center">
          <h3 className="text-xl font-bold text-white mb-4">Connect Wallet</h3>
          <p className="text-gray-400 mb-4">You need to connect your wallet to quote tweet.</p>
          <button onClick={onClose} className="px-4 py-2 bg-[#00FF88] text-black rounded-lg font-semibold">
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#111111] border border-[#1A1A1A] rounded-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-4 border-b border-[#1A1A1A]">
          <h3 className="text-xl font-bold text-white">Quote Tweet</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-4 space-y-4">
          {/* Quote Input */}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Add your thoughts (optional)"
            className="w-full bg-[#0A0A0A] border border-[#1A1A1A] rounded-xl p-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#00FF88] resize-none"
            rows={3}
            autoFocus
          />

          {/* Original Post Preview */}
          <div className="p-4 bg-[#0A0A0A] border border-[#1A1A1A] rounded-xl">
            <div className="flex items-center gap-3 mb-2">
              <Avatar className="w-8 h-8">
                <AvatarImage src={post.author?.avatar_url || ''} />
                <AvatarFallback className="bg-[#1A1A1A] text-white">
                  {post.author?.display_name?.charAt(0) || 'A'}
                </AvatarFallback>
              </Avatar>
              <div className="text-white font-semibold">{post.author?.display_name || 'Anonymous'}</div>
              <div className="text-gray-500">@{post.author?.username || 'unknown'}</div>
            </div>
            <div className="text-gray-300">{post.content}</div>
            
            {post.media_urls && post.media_urls.length > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {post.media_urls.slice(0, 4).map((url, i) => (
                  <img 
                    key={i} 
                    src={url} 
                    alt="" 
                    className="rounded-lg object-cover aspect-square" 
                  />
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-white hover:bg-[#1A1A1A] rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleQuote}
              disabled={loading}
              className="px-6 py-2 bg-gradient-to-r from-[#00FF88] to-[#00CC6A] text-black font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              {loading ? 'Posting...' : 'Quote Tweet'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}