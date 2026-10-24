import React, { useState, useEffect, useRef } from 'react';
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  MoreVertical,
  Music,
  Plus,
  Check,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Sliders,
  Sparkles,
  Send,
  X,
  Copy,
  Flame,
  ThumbsUp,
  AlertCircle,
} from 'lucide-react';
import { PostItem, UserAccount, PublicUserSummary } from '../types/blin';
import { UserAvatar } from './BlinLogo';
import { apiRequest, formatRelativeTime } from '../lib/api';

interface SpotlightReelsProps {
  user: UserAccount;
  reels: PostItem[];
  allUsers: PublicUserSummary[];
  onRefreshAll: () => Promise<void>;
  onOpenComposer: () => void;
  onSelectUsername: (username: string) => void;
  onNavigateHome: () => void;
}

export function SpotlightReels({
  user,
  reels,
  allUsers,
  onRefreshAll,
  onOpenComposer,
  onSelectUsername,
  onNavigateHome,
}: SpotlightReelsProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [showPlayIcon, setShowPlayIcon] = useState(false);
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const [burstCoords, setBurstCoords] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [activeCommentsPostId, setActiveCommentsPostId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  // Filter only spotlight reel posts
  const spotlightList = reels.filter(
    (p) => p.postType === 'spotlight_reel' || (p.mediaType === 'video' && p.aspectRatio === 'vertical')
  );

  const currentReel = spotlightList[activeIndex] || null;

  // Handle keyboard arrow navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (activeCommentsPostId) return; // Don't hijack while typing
      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        setActiveIndex((prev) => Math.min(spotlightList.length - 1, prev + 1));
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        setActiveIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.key === 'm') {
        e.preventDefault();
        setIsMuted((m) => !m);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [spotlightList.length, activeCommentsPostId]);

  // Synchronize video play/pause
  useEffect(() => {
    videoRefs.current.forEach((vid, idx) => {
      if (!vid) return;
      if (idx === activeIndex) {
        vid.playbackRate = playbackSpeed;
        vid.muted = isMuted;
        if (isPlaying) {
          vid.play().catch(() => {});
        } else {
          vid.pause();
        }
      } else {
        vid.pause();
        vid.currentTime = 0;
      }
    });
  }, [activeIndex, isPlaying, isMuted, playbackSpeed]);

  async function handleToggleLike(post: PostItem) {
    try {
      await apiRequest(`/api/posts/${post.id}/like`, { method: 'POST' });
      await onRefreshAll();
    } catch (err) {
      console.error('Failed to like reel', err);
    }
  }

  async function handleToggleSave(post: PostItem) {
    try {
      await apiRequest(`/api/posts/${post.id}/save`, { method: 'POST' });
      await onRefreshAll();
    } catch (err) {
      console.error('Failed to save reel', err);
    }
  }

  async function handleFollowAuthor(authorId: string) {
    try {
      await apiRequest(`/api/users/${authorId}/follow`, { method: 'POST' });
      await onRefreshAll();
    } catch (err) {
      console.error('Failed to follow author', err);
    }
  }

  function handleVideoClick(e: React.MouseEvent) {
    setIsPlaying((prev) => !prev);
    setShowPlayIcon(true);
    setTimeout(() => setShowPlayIcon(false), 600);
  }

  function handleDoubleTap(e: React.MouseEvent, post: PostItem) {
    const rect = e.currentTarget.getBoundingClientRect();
    setBurstCoords({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setShowHeartBurst(true);
    setTimeout(() => setShowHeartBurst(false), 800);
    if (!post.likeUserIds.includes(user.id)) {
      handleToggleLike(post);
    }
  }

  async function handleAddComment(e: React.FormEvent, postId: string) {
    e.preventDefault();
    if (!commentText.trim()) return;
    try {
      await apiRequest(`/api/posts/${postId}/comment`, {
        method: 'POST',
        body: JSON.stringify({ content: commentText.trim() }),
      });
      setCommentText('');
      await onRefreshAll();
    } catch (err) {
      console.error('Failed to add comment', err);
    }
  }

  // Format large numbers (e.g. 124.8K)
  function formatCompactNumber(num: number): string {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return String(num);
  }

  if (spotlightList.length === 0) {
    return (
      <div className="w-full max-w-md mx-auto min-h-[calc(100vh-140px)] flex flex-col items-center justify-center p-6 text-center space-y-5">
        <div className="w-20 h-20 rounded-3xl blin-reels-gradient flex items-center justify-center shadow-xl shadow-pink-500/20">
          <Sparkles className="w-10 h-10 text-white animate-pulse" />
        </div>
        <div className="space-y-2">
          <h2 className="font-display font-extrabold text-2xl text-white">No Reels Yet</h2>
          <p className="text-sm text-slate-400 max-w-xs leading-relaxed">
            BLiN Reels is your dedicated vertical video stage. Be the first to share an authentic reel and earn +10 BLiN Points for every unique like!
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
          <button
            type="button"
            onClick={onOpenComposer}
            className="flex-1 min-h-[46px] rounded-2xl blin-cta-gradient text-white text-sm font-bold shadow-lg shadow-purple-500/25 flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create First Reel</span>
          </button>
          <button
            type="button"
            onClick={onNavigateHome}
            className="px-4 min-h-[46px] rounded-2xl bg-white/10 hover:bg-white/15 text-slate-300 text-sm font-semibold"
          >
            Go to Home Feed
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex justify-center py-2 sm:py-4">
      {/* Container simulating high-end mobile vertical reel view */}
      <div
        ref={containerRef}
        className="relative w-full max-w-[440px] h-[calc(100vh-130px)] min-h-[640px] max-h-[880px] bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/10 select-none"
      >
        {spotlightList.map((post, idx) => {
          const isCurrent = idx === activeIndex;
          const isLiked = post.likeUserIds.includes(user.id);
          const isSaved = post.savedUserIds.includes(user.id);
          const isAuthor = post.authorId === user.id;
          const isFollowing = user.followingIds.includes(post.authorId);

          if (!isCurrent) return null;

          return (
            <div
              key={post.id}
              className="absolute inset-0 w-full h-full flex flex-col justify-between overflow-hidden"
            >
              {/* VIDEO BACKGROUND / SIMULATION CANVAS */}
              <div
                className="absolute inset-0 w-full h-full cursor-pointer"
                onClick={handleVideoClick}
                onDoubleClick={(e) => handleDoubleTap(e, post)}
              >
                {post.mediaUrl && post.mediaType === 'video' ? (
                  <video
                    ref={(el) => {
                      videoRefs.current[idx] = el;
                    }}
                    src={post.mediaUrl}
                    loop
                    playsInline
                    autoPlay
                    muted={isMuted}
                    className="w-full h-full object-cover"
                  />
                ) : post.mediaUrl && post.mediaType === 'image' ? (
                  <img
                    src={post.mediaUrl}
                    alt={post.caption || 'Reel media'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  // Gradient animated canvas backdrop matching sunset/neon aesthetic
                  <div className="w-full h-full bg-gradient-to-br from-purple-950 via-indigo-950 to-pink-950 flex items-center justify-center p-8 relative overflow-hidden">
                    <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_50%_40%,#ec4899_0%,transparent_60%)] animate-pulse" />
                    <div className="relative text-center space-y-4 max-w-xs">
                      <div className="w-20 h-20 mx-auto rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
                        <Music className="w-8 h-8 text-pink-300 animate-bounce" />
                      </div>
                      <p className="font-display font-bold text-xl text-white leading-relaxed drop-shadow-md">
                        {post.caption}
                      </p>
                    </div>
                  </div>
                )}

                {/* Dark gradients for text legibility top and bottom */}
                <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/80 via-black/40 to-transparent pointer-events-none" />
                <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black/95 via-black/60 to-transparent pointer-events-none" />

                {/* Play/Pause center overlay ripple */}
                {showPlayIcon && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-16 h-16 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white scale-110 transition-transform">
                      {isPlaying ? <Play className="w-8 h-8 fill-white ml-1" /> : <Pause className="w-8 h-8 fill-white" />}
                    </div>
                  </div>
                )}

                {/* Double Tap Heart Burst */}
                {showHeartBurst && (
                  <div
                    className="absolute pointer-events-none transform -translate-x-1/2 -translate-y-1/2 animate-ping"
                    style={{ left: burstCoords.x, top: burstCoords.y }}
                  >
                    <Heart className="w-24 h-24 text-pink-500 fill-pink-500 drop-shadow-xl" />
                  </div>
                )}
              </div>

              {/* TOP OVERLAY PILLS: Spotlight Tag, Duration & Quality */}
              <div className="relative z-10 px-4 pt-4 flex items-center justify-between text-xs font-semibold text-white pointer-events-none">
                <div className="flex items-center gap-2 pointer-events-auto">
                  <div className="px-3 py-1 rounded-full bg-gradient-to-r from-pink-600/90 to-violet-600/90 backdrop-blur-md border border-pink-400/30 flex items-center gap-1.5 shadow-lg">
                    {/* Snapchat-style play triangle */}
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-cyan-200 stroke-none">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    <span className="font-bold">Reels</span>
                  </div>
                  <div className="px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-slate-300">
                    {post.videoDuration || '0:28'}
                  </div>
                  <div className="px-2 py-0.5 rounded-md bg-white/15 backdrop-blur-md text-[10px] font-bold tracking-wider text-white">
                    HD
                  </div>
                </div>

                <div className="flex items-center gap-2 pointer-events-auto">
                  {/* Mute toggle */}
                  <button
                    type="button"
                    onClick={() => setIsMuted((m) => !m)}
                    className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-md border border-white/15 flex items-center justify-center text-white hover:bg-black/60 transition-colors"
                    title={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted ? <VolumeX className="w-4 h-4 text-pink-300" /> : <Volume2 className="w-4 h-4" />}
                  </button>

                  {/* Reel navigation buttons (desktop friendly) */}
                  <div className="flex items-center gap-1 bg-black/40 backdrop-blur-md rounded-full border border-white/15 p-0.5">
                    <button
                      type="button"
                      disabled={activeIndex === 0}
                      onClick={() => setActiveIndex((prev) => Math.max(0, prev - 1))}
                      className="px-2 py-1 text-xs text-slate-300 hover:text-white disabled:opacity-30"
                      title="Previous Reel (Up Arrow)"
                    >
                      ▲
                    </button>
                    <span className="text-[11px] text-slate-400">
                      {activeIndex + 1}/{spotlightList.length}
                    </span>
                    <button
                      type="button"
                      disabled={activeIndex === spotlightList.length - 1}
                      onClick={() => setActiveIndex((prev) => Math.min(spotlightList.length - 1, prev + 1))}
                      className="px-2 py-1 text-xs text-slate-300 hover:text-white disabled:opacity-30"
                      title="Next Reel (Down Arrow)"
                    >
                      ▼
                    </button>
                  </div>
                </div>
              </div>

              {/* RIGHT ACTION COLUMN */}
              <div className="absolute right-3 bottom-24 z-20 flex flex-col items-center gap-4 text-white">
                {/* Creator Avatar with follow '+' pill */}
                <div className="relative group">
                  <button
                    type="button"
                    onClick={() => onSelectUsername(post.authorUsername || '')}
                    className="w-12 h-12 rounded-full p-0.5 bg-gradient-to-tr from-pink-500 to-violet-500 shadow-xl overflow-hidden"
                  >
                    <UserAvatar
                      name={post.authorDisplayName || 'Creator'}
                      avatarUrl={post.authorAvatar}
                      size="md"
                    />
                  </button>

                  {!isAuthor && !isFollowing && (
                    <button
                      type="button"
                      onClick={() => handleFollowAuthor(post.authorId)}
                      className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-pink-500 hover:bg-pink-400 text-white flex items-center justify-center shadow-lg transition-transform hover:scale-110"
                      title="Follow creator (+1 pt)"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[3]" />
                    </button>
                  )}
                </div>

                {/* Heart / Like button */}
                <div className="flex flex-col items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleToggleLike(post)}
                    className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md border border-white/15 flex items-center justify-center hover:bg-black/60 transition-transform active:scale-90"
                    title="Like Reel (+10 BLiN Points to creator)"
                  >
                    <Heart
                      className={`w-6 h-6 transition-colors ${
                        isLiked ? 'text-pink-500 fill-pink-500' : 'text-white'
                      }`}
                    />
                  </button>
                  <span className="text-[11px] font-bold text-slate-200 drop-shadow">
                    {formatCompactNumber(post.likeUserIds.length)}
                  </span>
                </div>

                {/* Comments button */}
                <div className="flex flex-col items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveCommentsPostId(post.id)}
                    className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md border border-white/15 flex items-center justify-center hover:bg-black/60 transition-transform active:scale-90"
                    title="Comments"
                  >
                    <MessageCircle className="w-6 h-6 text-white" />
                  </button>
                  <span className="text-[11px] font-bold text-slate-200 drop-shadow">
                    {formatCompactNumber(post.comments.length)}
                  </span>
                </div>

                {/* Share button */}
                <div className="flex flex-col items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowShareModal(true)}
                    className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md border border-white/15 flex items-center justify-center hover:bg-black/60 transition-transform active:scale-90"
                    title="Share Reel"
                  >
                    <Share2 className="w-5 h-5 text-white" />
                  </button>
                  <span className="text-[11px] font-bold text-slate-200 drop-shadow">
                    {formatCompactNumber(post.shareCount || 0)}
                  </span>
                </div>

                {/* Bookmark button */}
                <div className="flex flex-col items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleToggleSave(post)}
                    className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md border border-white/15 flex items-center justify-center hover:bg-black/60 transition-transform active:scale-90"
                    title="Bookmark Reel"
                  >
                    <Bookmark
                      className={`w-5 h-5 transition-colors ${
                        isSaved ? 'text-cyan-300 fill-cyan-300' : 'text-white'
                      }`}
                    />
                  </button>
                  <span className="text-[11px] font-bold text-slate-200 drop-shadow">
                    {formatCompactNumber(post.savedUserIds.length)}
                  </span>
                </div>

                {/* More / Settings menu */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowSpeedMenu((p) => !p)}
                    className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md border border-white/15 flex items-center justify-center hover:bg-black/60 transition-colors"
                    title="Reel Controls"
                  >
                    <MoreVertical className="w-4 h-4 text-white" />
                  </button>

                  {showSpeedMenu && (
                    <div className="absolute right-0 bottom-11 w-44 rounded-2xl bg-[#090D26]/95 backdrop-blur-xl border border-white/15 p-2 shadow-2xl text-xs space-y-1.5 z-30">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 pt-1">
                        Playback Speed
                      </p>
                      <div className="grid grid-cols-3 gap-1">
                        {[0.75, 1, 1.5].map((speed) => (
                          <button
                            key={speed}
                            type="button"
                            onClick={() => {
                              setPlaybackSpeed(speed);
                              setShowSpeedMenu(false);
                            }}
                            className={`py-1 rounded-lg text-center font-bold ${
                              playbackSpeed === speed
                                ? 'bg-violet-600 text-white'
                                : 'bg-white/5 text-slate-300 hover:bg-white/10'
                            }`}
                          >
                            {speed}x
                          </button>
                        ))}
                      </div>
                      <div className="pt-1 border-t border-white/10">
                        <button
                          type="button"
                          onClick={() => {
                            setIsMuted((m) => !m);
                            setShowSpeedMenu(false);
                          }}
                          className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-white/10 text-slate-300 flex items-center justify-between"
                        >
                          <span>Audio</span>
                          <span>{isMuted ? 'Muted' : 'Unmuted'}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* BOTTOM CREATOR INFO & CAPTION OVERLAY */}
              <div className="relative z-10 px-4 pb-4 space-y-2.5 max-w-[85%] text-left">
                {/* Author row */}
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => onSelectUsername(post.authorUsername || '')}
                    className="flex items-center gap-2 group text-left min-w-0"
                  >
                    <UserAvatar
                      name={post.authorDisplayName || 'Creator'}
                      avatarUrl={post.authorAvatar}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-display font-bold text-sm text-white group-hover:text-cyan-300 transition-colors truncate">
                          {post.authorDisplayName}
                        </span>
                        {post.authorVerified && (
                          <span className="w-4 h-4 rounded-full bg-cyan-400 text-black flex items-center justify-center text-[10px] font-bold shrink-0">
                            ✓
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-300/80">@{post.authorUsername}</span>
                    </div>
                  </button>

                  {!isAuthor && (
                    <button
                      type="button"
                      onClick={() => handleFollowAuthor(post.authorId)}
                      className={`min-h-[30px] px-3.5 rounded-full text-xs font-bold transition-all shadow-md shrink-0 ${
                        isFollowing
                          ? 'bg-white/15 text-slate-200 border border-white/20'
                          : 'blin-cta-gradient text-white hover:scale-105'
                      }`}
                    >
                      {isFollowing ? 'Following' : 'Follow'}
                    </button>
                  )}
                </div>

                {/* Caption & Hashtags */}
                {post.caption && (
                  <p className="text-xs sm:text-sm text-slate-100 leading-relaxed drop-shadow line-clamp-3">
                    {post.caption}
                  </p>
                )}

                {/* Topic tags */}
                {post.topics && post.topics.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-cyan-300 drop-shadow">
                    {post.topics.map((tag) => (
                      <span key={tag} className="hover:underline cursor-pointer">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Audio track chip with animated soundwave */}
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-md border border-white/15 text-xs text-white max-w-full">
                  <Music className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                  <span className="truncate text-slate-200">
                    {post.audioAttribution || `Original sound - ${post.authorDisplayName}`}
                  </span>
                  {/* Equalizer soundwave */}
                  <div className="flex items-end gap-0.5 h-3 shrink-0 ml-1">
                    <span className="w-0.5 h-full bg-pink-400 rounded-full animate-pulse" />
                    <span
                      className="w-0.5 h-2 bg-pink-400 rounded-full animate-pulse"
                      style={{ animationDelay: '150ms' }}
                    />
                    <span
                      className="w-0.5 h-3 bg-cyan-400 rounded-full animate-pulse"
                      style={{ animationDelay: '300ms' }}
                    />
                    <span
                      className="w-0.5 h-1.5 bg-violet-400 rounded-full animate-pulse"
                      style={{ animationDelay: '450ms' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* BOTTOM COMMENTS DRAWER (SLIDE-UP SHEET) */}
        {activeCommentsPostId && (
          <div className="absolute inset-0 z-40 bg-black/75 backdrop-blur-md flex flex-col justify-end">
            <div className="w-full h-[65%] bg-[#080C26] rounded-t-3xl border-t border-white/15 p-4 flex flex-col justify-between shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-violet-400" />
                  <span className="font-display font-bold text-sm text-white">
                    Comments ({currentReel?.comments.length || 0})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveCommentsPostId(null)}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-slate-300 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Comments list */}
              <div className="flex-1 overflow-y-auto py-3 space-y-3.5">
                {currentReel?.comments.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
                    <MessageCircle className="w-8 h-8 text-slate-500" />
                    <p className="text-xs text-slate-400">
                      No comments yet on this reel. Be the first to spark the conversation!
                    </p>
                  </div>
                ) : (
                  currentReel?.comments.map((c) => (
                    <div key={c.id} className="flex items-start gap-2.5 text-xs">
                      <UserAvatar name={c.authorDisplayName} avatarUrl={c.authorAvatar} size="xs" />
                      <div className="flex-1 bg-white/[0.04] p-2.5 rounded-2xl border border-white/5 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-cyan-300">@{c.authorUsername}</span>
                          <span className="text-[10px] text-slate-500">
                            {formatRelativeTime(c.createdAt)}
                          </span>
                        </div>
                        <p className="text-slate-200 leading-relaxed">{c.content}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Add comment input */}
              <form
                onSubmit={(e) => currentReel && handleAddComment(e, currentReel.id)}
                className="pt-2 border-t border-white/10 flex items-center gap-2"
              >
                <UserAvatar name={user.displayName} avatarUrl={user.avatarUrl} size="xs" />
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add authentic comment..."
                  className="flex-1 min-h-[38px] px-3.5 rounded-full bg-[#050818] border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                />
                <button
                  type="submit"
                  disabled={!commentText.trim()}
                  className="min-w-[38px] min-h-[38px] rounded-full blin-cta-gradient text-white flex items-center justify-center disabled:opacity-40"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          </div>
        )}

        {/* SHARE SHEET MODAL */}
        {showShareModal && (
          <div className="absolute inset-0 z-40 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
            <div className="w-full max-w-xs bg-[#090D28] rounded-3xl border border-white/15 p-5 space-y-4 shadow-2xl text-center">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center">
                <Share2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-display font-bold text-base text-white">Share Spotlight Reel</h3>
                <p className="text-xs text-slate-400">Share this authentic video with friends or communities.</p>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={async () => {
                    const url = `${window.location.origin}/#reel-${currentReel?.id}`;
                    await navigator.clipboard.writeText(url).catch(() => {});
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                  }}
                  className="w-full min-h-[42px] px-4 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white flex items-center justify-center gap-2"
                >
                  {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedLink ? 'Link Copied to Clipboard!' : 'Copy Direct Link'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowShareModal(false)}
                  className="w-full min-h-[40px] rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
