import React, { useState, useEffect } from 'react';
import {
  Compass,
  TrendingUp,
  Sparkles,
  Flame,
  Search,
  Music,
  Radio,
  Play,
  Award,
  Users,
  Film,
  Plus,
  Check,
  ChevronRight,
} from 'lucide-react';
import {
  UserAccount,
  DiscoverData,
  PublicUserSummary,
  PostItem,
  VoiceRoomItem,
} from '../types/blin';
import { UserAvatar } from './BlinLogo';
import { apiRequest } from '../lib/api';

interface DiscoverHubProps {
  user: UserAccount;
  onNavigateToReels: (index?: number) => void;
  onNavigateToVoice: (roomId?: string) => void;
  onSelectCreator: (username: string) => void;
  onRefreshAll: () => Promise<void>;
}

export function DiscoverHub({
  user,
  onNavigateToReels,
  onNavigateToVoice,
  onSelectCreator,
  onRefreshAll,
}: DiscoverHubProps) {
  const [data, setData] = useState<DiscoverData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');

  useEffect(() => {
    async function loadDiscover() {
      try {
        const res = await apiRequest<DiscoverData>('/api/discover');
        setData(res);
      } catch (err) {
        console.error('Failed to load discover data', err);
      } finally {
        setLoading(false);
      }
    }
    loadDiscover();
  }, []);

  async function handleFollow(creatorId: string) {
    try {
      await apiRequest(`/api/users/${creatorId}/follow`, { method: 'POST' });
      await onRefreshAll();
      const res = await apiRequest<DiscoverData>('/api/discover');
      setData(res);
    } catch (err) {
      console.error('Failed to follow creator', err);
    }
  }

  const q = searchQuery.toLowerCase().trim();

  const filteredTopics = (data?.trendingTopics || []).filter(
    (t) => !q || t.tag.toLowerCase().includes(q) || t.category.toLowerCase().includes(q)
  );

  const filteredCreators = (data?.topCreators || []).filter(
    (c) => !q || c.displayName.toLowerCase().includes(q) || c.username.toLowerCase().includes(q)
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-2">
      {/* DISCOVER HEADER & SEARCH */}
      <div className="blin-surface rounded-3xl p-6 sm:p-8 space-y-4 border border-white/10 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl blin-cta-gradient flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
                <Compass className="w-5 h-5 animate-spin-slow" />
              </div>
              <h1 className="font-display font-extrabold text-2xl text-white">Discover BLiN</h1>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Explore breakout reels, rising creators, viral soundbites, and live voice rooms.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs font-bold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Real & Algorithmic Free</span>
            </span>
          </div>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search topics, hashtags, creators, or sounds..."
            className="w-full min-h-[44px] pl-11 pr-4 rounded-2xl bg-[#06091D] border border-white/15 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1">
          {['All', 'Trending Reels', 'Top Creators', 'Voice Stages', 'Hashtags'].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                activeCategory === cat
                  ? 'blin-cta-gradient text-white shadow-md'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* TRENDING TOPICS CHIPS */}
      {(activeCategory === 'All' || activeCategory === 'Hashtags') && (
        <div className="blin-surface rounded-3xl p-5 space-y-3 border border-white/10 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
              <Flame className="w-4 h-4 text-pink-400" />
              <span>Trending BLiN Topics</span>
            </div>
            <span className="text-[11px] text-cyan-300 font-semibold">Live Real-time</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {filteredTopics.map((item) => (
              <div
                key={item.tag}
                onClick={() => setSearchQuery(item.tag)}
                className="p-3 rounded-2xl bg-white/[0.03] hover:bg-violet-600/15 border border-white/5 hover:border-violet-500/30 cursor-pointer transition-colors space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-pink-400 font-bold">#{item.trendingRank}</span>
                  <span className="text-[10px] text-slate-400">{item.postsCount} posts</span>
                </div>
                <p className="font-display font-bold text-sm text-white truncate">#{item.tag}</p>
                <p className="text-[10px] text-slate-400 truncate">{item.category}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DISCOVER REELS (Snapchat-style Discover Grid) */}
      {(activeCategory === 'All' || activeCategory === 'Trending Reels') && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Film className="w-4 h-4 text-pink-400" />
              <span>Trending Reels</span>
            </div>
            <button
              type="button"
              onClick={() => onNavigateToReels(0)}
              className="text-xs text-cyan-300 hover:underline flex items-center gap-1 font-semibold"
            >
              <span>Watch Fullscreen</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {(data?.trendingReels || []).length === 0 ? (
            <div className="blin-surface rounded-3xl p-8 text-center space-y-2">
              <Film className="w-8 h-8 text-slate-500 mx-auto" />
              <p className="text-xs text-slate-400">
                No reels uploaded yet. Be the first to create one!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {(data?.trendingReels || []).map((reel, idx) => (
                <div
                  key={reel.id}
                  onClick={() => onNavigateToReels(idx)}
                  className="rounded-2xl overflow-hidden aspect-[9/14] bg-black/60 border border-white/10 hover:border-pink-500/50 cursor-pointer relative group transition-all transform hover:scale-[1.02] shadow-xl"
                >
                  {reel.mediaUrl && reel.mediaType === 'image' ? (
                    <img
                      src={reel.mediaUrl}
                      alt={reel.caption}
                      className="w-full h-full object-cover"
                    />
                  ) : reel.mediaUrl && reel.mediaType === 'video' ? (
                    <video
                      src={reel.mediaUrl}
                      muted
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full blin-reels-gradient flex items-center justify-center p-3 text-center">
                      <p className="text-xs font-bold text-white line-clamp-3">{reel.caption}</p>
                    </div>
                  )}

                  {/* Gradient dark overlays */}
                  <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black via-black/40 to-transparent pointer-events-none" />

                  {/* Play badge */}
                  <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white">
                    <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
                  </div>

                  {/* Bottom info */}
                  <div className="absolute inset-x-0 bottom-0 p-3 space-y-1">
                    <p className="text-xs font-bold text-white truncate drop-shadow">
                      {reel.authorDisplayName}
                    </p>
                    <p className="text-[11px] text-slate-300 line-clamp-2 leading-snug drop-shadow">
                      {reel.caption}
                    </p>
                    <div className="flex items-center gap-2 pt-1 text-[10px] text-pink-300 font-bold">
                      <span>♥ {reel.likeUserIds.length}</span>
                      <span>·</span>
                      <span>💬 {reel.comments.length}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TOP CREATORS LEADERBOARD */}
      {(activeCategory === 'All' || activeCategory === 'Top Creators') && (
        <div className="blin-surface rounded-3xl p-5 space-y-4 border border-white/10 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
              <Award className="w-4 h-4 text-cyan-400" />
              <span>Top BLiN Creators & Members</span>
            </div>
            <span className="text-[11px] text-slate-400">Ranked by Authenticity & Points</span>
          </div>

          <div className="space-y-2.5">
            {filteredCreators.map((creator, rank) => {
              const isSelf = creator.id === user.id;
              return (
                <div
                  key={creator.id}
                  className="p-3.5 rounded-2xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 flex items-center justify-between gap-3 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-display font-bold text-sm text-slate-500 w-4 text-center">
                      {rank + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => onSelectCreator(creator.username)}
                      className="flex items-center gap-2.5 text-left min-w-0 group"
                    >
                      <UserAvatar
                        name={creator.displayName}
                        avatarUrl={creator.avatarUrl}
                        size="md"
                        isOnline={creator.isOnline}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-display font-bold text-sm text-white group-hover:text-cyan-300 transition-colors truncate">
                            {creator.displayName}
                          </p>
                          {creator.verified && (
                            <span className="w-3.5 h-3.5 rounded-full bg-cyan-400 text-black text-[9px] font-bold flex items-center justify-center shrink-0">
                              ✓
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 truncate">
                          @{creator.username} · {creator.followerCount} followers
                        </p>
                      </div>
                    </button>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right hidden sm:block">
                      <span className="text-xs font-bold text-cyan-300">
                        {creator.pointsBalance || 0} pts
                      </span>
                    </div>

                    {!isSelf && (
                      <button
                        type="button"
                        onClick={() => handleFollow(creator.id)}
                        className={`min-h-[34px] px-3.5 rounded-xl text-xs font-bold transition-all ${
                          creator.isFollowing
                            ? 'bg-white/10 text-slate-300 border border-white/15'
                            : 'blin-cta-gradient text-white shadow-md'
                        }`}
                      >
                        {creator.isFollowing ? 'Following' : 'Follow'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ACTIVE LIVE VOICE ROOMS */}
      {(activeCategory === 'All' || activeCategory === 'Voice Stages') && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Radio className="w-4 h-4 text-pink-400 animate-pulse" />
              <span>Live Voice Stages Now</span>
            </div>
          </div>

          {(data?.activeVoiceRooms || []).length === 0 ? (
            <div className="blin-surface rounded-3xl p-6 text-center space-y-2">
              <p className="text-xs text-slate-400">
                No active voice stages right now. Start one to get on the stage!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(data?.activeVoiceRooms || []).map((room) => (
                <div
                  key={room.id}
                  onClick={() => onNavigateToVoice(room.id)}
                  className="blin-surface rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:border-violet-500/40 transition-colors shadow-lg"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-pink-500 animate-ping" />
                      <span className="text-xs font-bold text-white truncate">{room.title}</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Hosted by @{room.hostUsername} · {room.topic}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-xl blin-cta-gradient text-white text-xs font-bold shrink-0 shadow-md"
                  >
                    Listen In
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
