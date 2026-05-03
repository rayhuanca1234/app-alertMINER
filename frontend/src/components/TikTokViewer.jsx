import React, { useEffect, useRef, useState } from 'react';
import { X, Heart, MessageCircle, Share2, MoreHorizontal, Download, Flag, EyeOff, Send } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

// Individual Slide Component to handle its own video playback and Supabase data
const MediaSlide = ({ item, isActive }) => {
  const videoRef = useRef(null);
  const { user } = useAuthStore();
  
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0); // Strict zero base
  const [showComments, setShowComments] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);

  // A UUID is exactly 36 characters long. We slice it to safely extract it even if there's a "-index" suffix
  const actualMessageId = String(item.id).slice(0, 36);
  const parts = String(item.id).split('-');
  const mediaIndex = parts.length > 5 ? parseInt(parts[5], 10) : 0;

  // Play/Pause based on visibility and View count
  useEffect(() => {
    let viewed = false;
    
    if (item.isVideo && videoRef.current) {
      if (isActive) {
        videoRef.current.play().catch(e => console.log('Autoplay prevented:', e));
      } else {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
    }

    if (isActive && !viewed) {
      // Increment view in Supabase with media_index and user_id (unique views)
      supabase.rpc('increment_media_views', { msg_id: actualMessageId, m_index: mediaIndex, u_id: user.id }).then(({ error }) => {
        if (error) console.error('Error incrementing views:', error);
      });
      viewed = true;
    }
  }, [isActive, item.isVideo, actualMessageId, mediaIndex, user.id]);

  // Fetch Likes and Comments when active
  useEffect(() => {
    if (!isActive) return;

    const fetchInteractions = async () => {
      try {
        // Fetch true views (if you want to use it as base or just display it)
        const { data: viewData } = await supabase
          .from('media_views')
          .select('views_count')
          .eq('message_id', actualMessageId)
          .eq('media_index', mediaIndex)
          .maybeSingle();
        
        const realViews = viewData ? viewData.views_count : 0;

        // Check if user liked it
        const { data: likeData } = await supabase
          .from('media_likes')
          .select('id')
          .eq('message_id', actualMessageId)
          .eq('media_index', mediaIndex)
          .eq('user_id', user.id)
          .maybeSingle();
        
        setIsLiked(!!likeData);

        // Get total likes count
        const { count } = await supabase
          .from('media_likes')
          .select('*', { count: 'exact', head: true })
          .eq('message_id', actualMessageId)
          .eq('media_index', mediaIndex);
          
        if (count !== null) setLikesCount(count); // Strictly count, no fake base

        // Fetch comments
        setLoadingComments(true);
        const { data: commentsData } = await supabase
          .from('media_comments')
          .select('*, profiles(name, avatar_url)')
          .eq('message_id', actualMessageId)
          .eq('media_index', mediaIndex)
          .order('created_at', { ascending: false });
          
        if (commentsData) setComments(commentsData);
      } catch (err) {
        console.error('Error fetching interactions:', err);
      } finally {
        setLoadingComments(false);
      }
    };

    fetchInteractions();
  }, [isActive, actualMessageId, mediaIndex, user.id]);

  const handleLike = async () => {
    try {
      if (isLiked) {
        setIsLiked(false);
        setLikesCount(prev => prev - 1);
        await supabase
          .from('media_likes')
          .delete()
          .eq('message_id', actualMessageId)
          .eq('media_index', mediaIndex)
          .eq('user_id', user.id);
      } else {
        setIsLiked(true);
        setLikesCount(prev => prev + 1);
        await supabase
          .from('media_likes')
          .insert({ message_id: actualMessageId, user_id: user.id, media_index: mediaIndex });
      }
    } catch (err) {
      console.error('Error toggling like:', err);
    }
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    const tempComment = {
      id: Date.now(),
      content: newComment,
      profiles: { name: user.email.split('@')[0], avatar_url: null }
    };
    
    setComments([tempComment, ...comments]);
    setNewComment('');

    try {
      await supabase
        .from('media_comments')
        .insert({ message_id: actualMessageId, user_id: user.id, media_index: mediaIndex, content: tempComment.content });
    } catch (err) {
      console.error('Error adding comment:', err);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'MinerAlert Media',
          url: item.url
        });
      } catch (err) {
        console.log('Share canceled or failed');
      }
    } else {
      navigator.clipboard.writeText(item.url);
      alert('Enlace copiado al portapapeles');
    }
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(item.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `minero_media_${Date.now()}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setShowOptions(false);
    } catch (err) {
      console.error('Download error:', err);
      alert('Error al descargar el archivo');
    }
  };

  return (
    <div className="h-[100dvh] w-full relative snap-start snap-always bg-black flex items-center justify-center overflow-hidden">
      {/* Blurred Background */}
      <div className="absolute inset-0 z-0">
        {item.isVideo ? (
          <video src={item.url} className="w-full h-full object-cover blur-3xl opacity-40 scale-125 pointer-events-none" muted playsInline autoPlay loop />
        ) : (
          <img src={item.url} className="w-full h-full object-cover blur-3xl opacity-40 scale-125 pointer-events-none" alt="" />
        )}
      </div>

      {/* Main Media */}
      {item.isVideo ? (
        <video 
          ref={videoRef}
          src={item.url} 
          className="w-full h-full object-contain relative z-10" 
          controls 
          loop
          playsInline
        />
      ) : (
        <img 
          src={item.url} 
          alt="Media content" 
          className="w-full h-full object-contain relative z-10" 
        />
      )}

      {/* Sidebar Actions */}
      <div className="absolute right-4 bottom-24 flex flex-col items-center gap-6 z-20">
        <button onClick={handleLike} className="flex flex-col items-center group">
          <div className={`p-3 rounded-full backdrop-blur-sm transition-transform active:scale-90 ${isLiked ? 'bg-red-500/20 text-red-500' : 'bg-black/20 text-white'}`}>
            <Heart size={28} fill={isLiked ? "currentColor" : "none"} />
          </div>
          <span className="text-white text-xs mt-1 font-bold">{likesCount}</span>
        </button>
        
        <button onClick={() => setShowComments(true)} className="flex flex-col items-center group">
          <div className="p-3 bg-black/20 rounded-full text-white backdrop-blur-sm group-active:scale-90 transition-transform">
            <MessageCircle size={28} />
          </div>
          <span className="text-white text-xs mt-1 font-bold">{comments.length}</span>
        </button>
        
        <button onClick={handleShare} className="flex flex-col items-center group">
          <div className="p-3 bg-black/20 rounded-full text-white backdrop-blur-sm group-active:scale-90 transition-transform">
            <Share2 size={28} />
          </div>
          <span className="text-white text-xs mt-1 font-bold">Compartir</span>
        </button>
        
        <button onClick={() => setShowOptions(true)} className="flex flex-col items-center group">
          <div className="p-3 bg-black/20 rounded-full text-white backdrop-blur-sm group-active:scale-90 transition-transform">
            <MoreHorizontal size={28} />
          </div>
        </button>
      </div>

      {/* Bottom Info */}
      <div className="absolute bottom-0 left-0 right-16 p-4 pt-12 bg-gradient-to-t from-black/80 to-transparent z-10 pointer-events-none">
        <div className="flex flex-col gap-1">
          <h3 className="text-white font-bold text-base pointer-events-auto">@miner_user</h3>
          <p className="text-white text-sm line-clamp-2 pointer-events-auto">
            Viendo archivo multimedia de mi perfil. #MinerAlert
          </p>
        </div>
      </div>

      {/* Comments Modal (Bottom Sheet) */}
      {showComments && (
        <>
          <div className="absolute inset-0 bg-black/50 z-30" onClick={() => setShowComments(false)} />
          <div className="absolute bottom-0 left-0 right-0 h-3/4 bg-[#111827] rounded-t-2xl z-40 flex flex-col animate-slideUp">
            <style dangerouslySetInnerHTML={{__html: `
              @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
              .animate-slideUp { animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
            `}} />
            <div className="p-4 border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-white font-bold">{comments.length} Comentarios</h3>
              <button onClick={() => setShowComments(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {loadingComments ? (
                <div className="text-center text-slate-500 text-sm mt-4">Cargando comentarios...</div>
              ) : comments.length === 0 ? (
                <div className="text-center text-slate-500 text-sm mt-4">Sé el primero en comentar.</div>
              ) : (
                comments.map((c, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
                      {c.profiles?.avatar_url ? (
                        <img src={c.profiles.avatar_url} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <span className="text-xs text-white uppercase">{c.profiles?.name?.slice(0,2) || 'U'}</span>
                      )}
                    </div>
                    <div>
                      <span className="text-slate-400 text-xs font-bold">{c.profiles?.name || 'Usuario'}</span>
                      <p className="text-slate-200 text-sm">{c.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleCommentSubmit} className="p-4 border-t border-slate-800 flex gap-2 items-center bg-[#111827]">
              <input 
                type="text" 
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                placeholder="Añadir comentario..." 
                className="flex-1 bg-slate-800 text-sm text-white rounded-full px-4 py-2 outline-none focus:ring-1 ring-blue-500"
              />
              <button type="submit" disabled={!newComment.trim()} className="p-2 text-blue-500 disabled:opacity-50">
                <Send size={20} />
              </button>
            </form>
          </div>
        </>
      )}

      {/* Options Modal (Bottom Sheet) */}
      {showOptions && (
        <>
          <div className="absolute inset-0 bg-black/50 z-30" onClick={() => setShowOptions(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-[#111827] rounded-t-2xl z-40 p-4 pb-8 flex flex-col gap-2 animate-slideUp">
            <div className="w-12 h-1.5 bg-slate-800 rounded-full mx-auto mb-4" />
            <button onClick={handleDownload} className="w-full flex items-center gap-3 p-4 bg-slate-800/50 rounded-xl text-white hover:bg-slate-800 transition">
              <Download size={20} /> <span className="font-medium">Guardar video</span>
            </button>
            <button className="w-full flex items-center gap-3 p-4 bg-slate-800/50 rounded-xl text-white hover:bg-slate-800 transition">
              <EyeOff size={20} /> <span className="font-medium">No me interesa</span>
            </button>
            <button className="w-full flex items-center gap-3 p-4 bg-red-500/10 rounded-xl text-red-500 hover:bg-red-500/20 transition">
              <Flag size={20} /> <span className="font-medium">Reportar</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default function TikTokViewer({ mediaList, initialIndex, onClose, onLoadMore, hasMore }) {
  const containerRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(initialIndex);

  useEffect(() => {
    // Scroll to the initial index on mount
    if (containerRef.current && initialIndex >= 0) {
      const height = window.innerHeight;
      containerRef.current.scrollTop = initialIndex * height;
    }
    
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'auto'; };
  }, [initialIndex]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const height = window.innerHeight;
    const scrollTop = containerRef.current.scrollTop;
    const index = Math.round(scrollTop / height);
    if (index !== activeIndex && index >= 0 && index < mediaList.length) {
      setActiveIndex(index);
    }
    
    // Load more when reaching near the end
    if (hasMore && onLoadMore && index >= mediaList.length - 2) {
      onLoadMore();
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black">
      <button 
        onClick={onClose}
        className="absolute top-10 right-4 z-[9999] p-2 bg-black/40 backdrop-blur-md rounded-full text-white active:scale-95 transition-transform"
      >
        <X size={24} />
      </button>

      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="h-[100dvh] overflow-y-scroll snap-y snap-mandatory scroll-smooth no-scrollbar"
        style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}
      >
        <style dangerouslySetInnerHTML={{__html: `
          .no-scrollbar::-webkit-scrollbar { display: none; }
        `}} />

        {mediaList.map((item, index) => (
          <MediaSlide 
            key={item.id || index} 
            item={item} 
            isActive={index === activeIndex} 
          />
        ))}
      </div>
    </div>
  );
}
