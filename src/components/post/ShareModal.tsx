'use client';

import { toast } from 'sonner';

interface ShareModalProps {
  postId: string;
  onClose: () => void;
}

export function ShareModal({ postId, onClose }: ShareModalProps) {
  const postUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/post/${postId}` 
    : '';

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(postUrl);
      toast.success('Link copied to clipboard!');
      onClose();
    } catch (error) {
      toast.error('Failed to copy link');
    }
  }

  function handleShareToX() {
    const text = encodeURIComponent('Check out this post on xbags!');
    const url = encodeURIComponent(postUrl);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#111111] border border-[#1A1A1A] rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-[#1A1A1A]">
          <h3 className="text-xl font-bold text-white">Share Post</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-4 space-y-3">
          <button
            onClick={handleCopyLink}
            className="w-full flex items-center gap-4 p-4 bg-[#0A0A0A] border border-[#1A1A1A] rounded-xl hover:bg-[#111111] transition-colors"
          >
            <div className="w-12 h-12 rounded-full bg-[#1A1A1A] flex items-center justify-center">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <div className="text-left">
              <div className="text-white font-semibold">Copy Link</div>
              <div className="text-gray-500 text-sm">Share via URL</div>
            </div>
          </button>
          
          <button
            onClick={handleShareToX}
            className="w-full flex items-center gap-4 p-4 bg-[#0A0A0A] border border-[#1A1A1A] rounded-xl hover:bg-[#111111] transition-colors"
          >
            <div className="w-12 h-12 rounded-full bg-[#1A1A1A] flex items-center justify-center">
              <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </div>
            <div className="text-left">
              <div className="text-white font-semibold">Share to X</div>
              <div className="text-gray-500 text-sm">Post to your timeline</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}