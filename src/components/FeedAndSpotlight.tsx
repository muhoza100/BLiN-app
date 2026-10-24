import React, { useState } from 'react';
import {
  Heart,
  MessageCircle,
  Repeat2,
  Bookmark,
  EyeOff,
  Trash2,
  Plus,
  Video,
  Image as ImageIcon,
  Users,
  Search,
  Music,
  Send,
  Sliders,
} from 'lucide-react';
import {
  UserAccount,
  PublicUserSummary,
  PostItem,
  StoryItem,
  CommunityItem,
} from '../types/blin';
import { UserAvatar } from './BlinLogo';
import { apiRequest, readFileAsDataUrl, formatRelativeTime } from '../lib/api';

export interface EnrichedPost extends PostItem {
  author: {
    id: string;
    displayName: string;
    username: string;
    avatarUrl: string;
    verified: boolean;
  };
  isLiked: boolean;
  isSaved: boolean;
  isReposted: boolean;
}

interface FeedSectionProps {
  user: UserAccount;
  posts: EnrichedPost[];
  stories: StoryItem[];
  onRefreshAll: () => Promise<void>;
  onOpenComposer: (mode: 'post' | 'spotlight' | 'story') => void;
  onSelectUsername: (username: string) => void;
  onOpenFeedSettings: () => void;
}

export function FeedSection({
  user,
  posts,
  stories,
  onRefreshAll,
  onOpenComposer,
  onSelectUsername,
  onOpenFeedSettings,
}: FeedSectionProps) {
  const [feedTab, setFeedTab] = useState<'for_you' | 'following' | 'explore'>(
    user.settings.followingOnlyMode ? 'following' : 'for_you'
  );
  const [activeStory, setActiveStory] = useState<StoryItem | null>(null);
  const [openCommentsPostId, setOpenCommentsPostId] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState('');

  const displayedPosts = posts.filter((p) => {
    // Homepage Feed is distinct from Spotlight Reels
    const isFeedPost = p.postType === 'feed' || (p.mediaType !== 'video' && p.postType !== 'spotlight_reel');
    if (!isFeedPost) return false;

    if (feedTab === 'following' || user.settings.followingOnlyMode) {
      return p.authorId === user.id || user.followingIds.includes(p.authorId);
    }
    return true;
  });

  const cardSpacing =
    user.settings.layoutDensity === 'compact'
      ? 'space-y-3'
      : user.settings.layoutDensity === 'spacious'
      ? 'space-y-7'
      : 'space-y-5';

  return (
    <div className={cardSpacing}>
      {/* Top Feed Tabs + Contextual Feed Personalization Trigger */}
      <div className="blin-surface rounded-2xl p-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {(['for_you', 'following', 'explore'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setFeedTab(t)}
              className={`min-h-[40px] px-4 rounded-xl text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                feedTab === t
                  ? 'blin-cta-gradient text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {t === 'for_you' ? 'For You' : t === 'following' ? 'Following' : 'Explore'}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onOpenFeedSettings}
          className="min-w-[40px] min-h-[40px] px-3 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-cyan-300 flex items-center gap-1.5 whitespace-nowrap"
          title="Feed Personalization Settings"
        >
          <Sliders className="w-4 h-4" />
          <span className="hidden sm:inline">Feed Controls</span>
        </button>
      </div>

      {/* Stories & 24h Status Strip */}
      <div className="blin-surface rounded-2xl p-4 flex items-center gap-4 overflow-x-auto">
        <button
          type="button"
          onClick={() => onOpenComposer('story')}
          className="flex flex-col items-center gap-1.5 shrink-0 group"
        >
          <div className="w-14 h-14 rounded-full p-0.5 bg-gradient-to-tr from-violet-500 to-cyan-400 relative">
            <div className="w-full h-full rounded-full bg-[#070A1E] flex items-center justify-center">
              <Plus className="w-5 h-5 text-cyan-300 group-hover:scale-110 transition-transform" />
            </div>
          </div>
          <span className="text-[11px] font-medium text-slate-300">Add Story</span>
        </button>

        {stories.map((st) => (
          <button
            key={st.id}
            type="button"
            onClick={() => setActiveStory(st)}
            className="flex flex-col items-center gap-1.5 shrink-0"
          >
            <div className="w-14 h-14 rounded-full p-0.5 bg-gradient-to-tr from-fuchsia-500 via-violet-500 to-cyan-400">
              <div className="w-full h-full rounded-full bg-[#070A1E] p-0.5 flex items-center justify-center overflow-hidden">
                <UserAvatar name={st.authorName} avatarUrl={st.authorAvatar} size="md" />
              </div>
            </div>
            <span className="text-[11px] text-slate-300 max-w-[68px] truncate">
              {st.authorId === user.id ? 'Your Story' : st.authorName}
            </span>
          </button>
        ))}

        {stories.length === 0 && (
          <p className="text-xs text-slate-400">
            Share a 24-hour story or mood update with Followers or Close Friends.
          </p>
        )}
      </div>

      {/* Posts Stream */}
      {displayedPosts.length === 0 ? (
        <div className="blin-surface rounded-3xl p-10 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-violet-600/15 border border-violet-500/30 flex items-center justify-center">
            <ImageIcon className="w-6 h-6 text-violet-300" />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h2 className="font-display font-bold text-xl text-white">Your BLiN Feed is Clean</h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              There are zero fake posts or artificial accounts on BLiN. Publish your first post or
              Spotlight video, or follow real members in Communities!
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => onOpenComposer('post')}
              className="min-h-[44px] px-5 rounded-xl blin-cta-gradient text-white font-semibold text-xs sm:text-sm"
            >
              Create First Post
            </button>
            <button
              type="button"
              onClick={() => onOpenComposer('spotlight')}
              className="min-h-[44px] px-5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs sm:text-sm"
            >
              Upload Spotlight Video
            </button>
          </div>
        </div>
      ) : (
        displayedPosts.map((post) => (
          <article key={post.id} className="blin-surface rounded-3xl p-5 space-y-4">
            {/* Author Row */}
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => onSelectUsername(post.author.username)}
                className="flex items-center gap-3 text-left min-w-0"
              >
                <UserAvatar
                  name={post.author.displayName}
                  avatarUrl={post.author.avatarUrl}
                  size="md"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-white">
                    <span className="truncate">{post.author.displayName}</span>
                    {post.author.verified && <span className="text-xs text-cyan-400">✓</span>}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <span>@{post.author.username}</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatRelativeTime(post.createdAt)}</span>
                    {post.kind === 'spotlight' && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-cyan-300">Spotlight</span>
                      </>
                    )}
                    {post.isSponsored && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-amber-300">Sponsored</span>
                      </>
                    )}
                  </div>
                </div>
              </button>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={async () => {
                    await apiRequest(`/api/posts/${post.id}/hide`, { method: 'POST' });
                    await onRefreshAll();
                  }}
                  className="min-w-[38px] min-h-[38px] rounded-xl hover:bg-white/10 flex items-center justify-center text-slate-400"
                  title="Hide post"
                >
                  <EyeOff className="w-4 h-4" />
                </button>
                {post.authorId === user.id && (
                  <button
                    type="button"
                    onClick={async () => {
                      await apiRequest(`/api/posts/${post.id}`, { method: 'DELETE' });
                      await onRefreshAll();
                    }}
                    className="min-w-[38px] min-h-[38px] rounded-xl hover:bg-rose-500/15 flex items-center justify-center text-rose-300"
                    title="Delete post"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Caption */}
            {post.caption && (
              <p className="text-sm sm:text-base text-slate-100 leading-relaxed whitespace-pre-wrap">
                {post.caption}
              </p>
            )}

            {/* Media */}
            {post.mediaUrl && post.mediaType === 'image' && (
              <div className="rounded-2xl overflow-hidden border border-white/10 bg-black/40">
                <img
                  src={post.mediaUrl}
                  alt={post.caption || 'Post photo'}
                  referrerPolicy="no-referrer"
                  className="w-full max-h-[500px] object-cover"
                />
              </div>
            )}

            {post.mediaUrl && post.mediaType === 'video' && (
              <div className="rounded-2xl overflow-hidden border border-white/10 bg-black/60 relative">
                <video
                  src={post.mediaUrl}
                  controls
                  autoPlay={user.settings.autoplayVideos === 'always'}
                  muted
                  playsInline
                  className="w-full max-h-[520px] object-contain"
                />
                {(user.settings.alwaysShowVideoCaptions || user.settings.autoCaptionGeneration) &&
                  post.caption && (
                    <div className="p-2.5 bg-black/70 text-xs text-center text-white">
                      [CC] {post.caption.slice(0, 100)}
                    </div>
                  )}
              </div>
            )}

            {/* Clean Unboxed Metadata Topics */}
            {post.topics.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-cyan-300/90">
                {post.topics.map((t, idx) => (
                  <React.Fragment key={t}>
                    {idx > 0 && <span aria-hidden="true">·</span>}
                    <span>#{t}</span>
                  </React.Fragment>
                ))}
              </div>
            )}

            {/* Actions Bar */}
            <div className="pt-2 border-t border-white/[0.08] flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={async () => {
                    await apiRequest(`/api/posts/${post.id}/like`, { method: 'POST' });
                    await onRefreshAll();
                  }}
                  className={`min-h-[40px] px-2.5 rounded-xl flex items-center gap-1.5 text-xs font-semibold transition-colors ${
                    post.isLiked
                      ? 'text-pink-400 bg-pink-500/10'
                      : 'text-slate-300 hover:bg-white/5'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${post.isLiked ? 'fill-pink-400' : ''}`} />
                  <span className="tabular-nums">{post.likeUserIds.length}</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setOpenCommentsPostId((prev) => (prev === post.id ? null : post.id))
                  }
                  className="min-h-[40px] px-2.5 rounded-xl flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:bg-white/5"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span className="tabular-nums">{post.comments.length}</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    await apiRequest(`/api/posts/${post.id}/repost`, { method: 'POST' });
                    await onRefreshAll();
                  }}
                  className={`min-h-[40px] px-2.5 rounded-xl flex items-center gap-1.5 text-xs font-semibold ${
                    post.isReposted ? 'text-emerald-300' : 'text-slate-300 hover:bg-white/5'
                  }`}
                >
                  <Repeat2 className="w-4 h-4" />
                  <span className="tabular-nums">{post.repostUserIds.length}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={async () => {
                  await apiRequest(`/api/posts/${post.id}/save`, { method: 'POST' });
                  await onRefreshAll();
                }}
                className={`min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center ${
                  post.isSaved ? 'text-cyan-300 bg-cyan-500/10' : 'text-slate-300 hover:bg-white/5'
                }`}
                title="Save post"
              >
                <Bookmark className={`w-4 h-4 ${post.isSaved ? 'fill-cyan-300' : ''}`} />
              </button>
            </div>

            {/* Comments Drawer */}
            {openCommentsPostId === post.id && (
              <div className="pt-3 border-t border-white/10 space-y-3">
                {post.comments.length === 0 ? (
                  <p className="text-xs text-slate-400">No comments yet — start the conversation.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {post.comments.map((c) => (
                      <div key={c.id} className="text-xs flex items-start gap-2">
                        <span className="font-semibold text-cyan-300">@{c.authorUsername}</span>
                        <span className="text-slate-200 flex-1">{c.content}</span>
                      </div>
                    ))}
                  </div>
                )}

                {post.allowComments && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!commentDraft.trim()) return;
                      await apiRequest(`/api/posts/${post.id}/comment`, {
                        method: 'POST',
                        body: JSON.stringify({ content: commentDraft }),
                      });
                      setCommentDraft('');
                      await onRefreshAll();
                    }}
                    className="flex gap-2"
                  >
                    <input
                      type="text"
                      value={commentDraft}
                      onChange={(e) => setCommentDraft(e.target.value)}
                      placeholder="Write a comment..."
                      className="flex-1 min-h-[38px] px-3 rounded-xl bg-[#070B22] border border-white/10 text-xs text-white"
                    />
                    <button
                      type="submit"
                      className="px-3.5 rounded-xl blin-cta-gradient text-white text-xs font-semibold"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>
                )}
              </div>
            )}
          </article>
        ))
      )}

      {/* Active Story Viewer Modal */}
      {activeStory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div
            className={`w-full max-w-sm min-h-[460px] rounded-3xl p-6 flex flex-col justify-between bg-gradient-to-br ${activeStory.backgroundGradient} text-white shadow-2xl relative`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <UserAvatar
                  name={activeStory.authorName}
                  avatarUrl={activeStory.authorAvatar}
                  size="sm"
                />
                <div className="text-xs">
                  <p className="font-bold">{activeStory.authorName}</p>
                  <p className="opacity-80">
                    @{activeStory.authorUsername} · {activeStory.audience}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveStory(null)}
                className="w-9 h-9 rounded-full bg-black/30 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="my-auto py-8 text-center space-y-4">
              {activeStory.mediaUrl && (
                <img
                  src={activeStory.mediaUrl}
                  alt="Story"
                  className="rounded-2xl max-h-64 mx-auto object-cover"
                />
              )}
              {activeStory.text && (
                <p className="font-display font-bold text-xl leading-snug">{activeStory.text}</p>
              )}
            </div>

            {activeStory.musicLabel && (
              <div className="flex items-center justify-center gap-1.5 text-xs opacity-90">
                <Music className="w-3.5 h-3.5" />
                <span>{activeStory.musicLabel}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// SPOTLIGHT / REELS VIEW
// =============================================================================
export function SpotlightSection({
  user,
  posts,
  onRefreshAll,
  onOpenComposer,
  onOpenSpotlightSettings,
  onSelectUsername,
}: {
  user: UserAccount;
  posts: EnrichedPost[];
  onRefreshAll: () => Promise<void>;
  onOpenComposer: () => void;
  onOpenSpotlightSettings: () => void;
  onSelectUsername: (u: string) => void;
}) {
  const spotlights = posts.filter((p) => p.kind === 'spotlight' || p.mediaType === 'video');

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-white">Spotlight</h1>
          <p className="text-xs text-slate-400">
            Short-form creator videos · {user.settings.defaultRecordingResolution} ·{' '}
            {user.settings.defaultFrameRate}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenSpotlightSettings}
            className="min-h-[42px] px-3.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-cyan-300 flex items-center gap-1.5"
          >
            <Sliders className="w-4 h-4" /> Creator Controls
          </button>
          <button
            type="button"
            onClick={onOpenComposer}
            className="min-h-[42px] px-4 rounded-xl blin-cta-gradient text-white text-xs font-semibold flex items-center gap-1.5"
          >
            <Video className="w-4 h-4" /> Upload Spotlight
          </button>
        </div>
      </div>

      {spotlights.length === 0 ? (
        <div className="blin-surface rounded-3xl p-12 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-fuchsia-600/15 border border-fuchsia-500/30 flex items-center justify-center">
            <Video className="w-6 h-6 text-fuchsia-300" />
          </div>
          <h2 className="font-display font-bold text-xl text-white">No Spotlight Videos Yet</h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
            Publish your first genuine Spotlight clip! Every unique like from another BLiN member
            earns 10 BLiN Points plus +5 bonus points every 10 likes.
          </p>
          <button
            type="button"
            onClick={onOpenComposer}
            className="min-h-[44px] px-5 rounded-xl blin-cta-gradient text-white font-semibold text-xs sm:text-sm"
          >
            Publish First Spotlight
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {spotlights.map((sp) => (
            <div
              key={sp.id}
              className="rounded-3xl overflow-hidden bg-[#0A0F28] border border-white/10 flex flex-col justify-between min-h-[420px] relative"
            >
              {sp.mediaUrl && sp.mediaType === 'video' ? (
                <video
                  src={sp.mediaUrl}
                  controls
                  playsInline
                  className="w-full h-72 object-cover bg-black"
                />
              ) : sp.mediaUrl ? (
                <img src={sp.mediaUrl} alt={sp.caption} className="w-full h-72 object-cover" />
              ) : (
                <div className="w-full h-72 bg-gradient-to-br from-violet-900/60 via-blue-900/50 to-cyan-900/50 flex items-center justify-center p-6 text-center">
                  <p className="font-display font-bold text-lg text-white">{sp.caption}</p>
                </div>
              )}

              <div className="p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => onSelectUsername(sp.author.username)}
                    className="flex items-center gap-2 text-left"
                  >
                    <UserAvatar
                      name={sp.author.displayName}
                      avatarUrl={sp.author.avatarUrl}
                      size="sm"
                    />
                    <div className="text-xs">
                      <p className="font-bold text-white">@{sp.author.username}</p>
                      {sp.audioAttribution && (
                        <p className="text-cyan-300 flex items-center gap-1">
                          <Music className="w-3 h-3" /> {sp.audioAttribution}
                        </p>
                      )}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      await apiRequest(`/api/posts/${sp.id}/like`, { method: 'POST' });
                      await onRefreshAll();
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 ${
                      sp.isLiked ? 'bg-pink-500/20 text-pink-300' : 'bg-white/10 text-white'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${sp.isLiked ? 'fill-pink-400' : ''}`} />
                    <span className="tabular-nums">{sp.likeUserIds.length}</span>
                  </button>
                </div>
                {sp.caption && <p className="text-xs text-slate-300">{sp.caption}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// COMMUNITIES & REAL MEMBER DIRECTORY
// =============================================================================
export function CommunitiesSection({
  user,
  communities,
  allUsers,
  onRefreshAll,
  onSelectUsername,
}: {
  user: UserAccount;
  communities: CommunityItem[];
  allUsers: PublicUserSummary[];
  onRefreshAll: () => Promise<void>;
  onSelectUsername: (u: string) => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [tab, setTab] = useState<'communities' | 'people'>('communities');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Creators Hub');
  const [description, setDescription] = useState('');

  const q = searchQuery.trim().toLowerCase();
  const filteredComms = communities.filter(
    (c) => !q || c.name.toLowerCase().includes(q) || c.category.toLowerCase().includes(q)
  );
  const filteredPeople = allUsers.filter(
    (u) =>
      !q ||
      u.displayName.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q)
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl text-white">Communities & People</h1>
          <p className="text-xs text-slate-400">
            Discover real registered BLiN members and user-created groups
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="min-h-[42px] px-4 rounded-xl blin-cta-gradient text-white text-xs font-semibold flex items-center gap-1.5 self-start whitespace-nowrap"
        >
          <Plus className="w-4 h-4" /> Create Community
        </button>
      </div>

      {/* Search & Mode Switch */}
      <div className="blin-surface rounded-2xl p-3.5 space-y-3">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search real communities or @usernames..."
            className="w-full min-h-[42px] pl-10 pr-4 rounded-xl bg-[#070B22] border border-blue-500/25 text-sm text-white"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab('communities')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold ${
              tab === 'communities' ? 'blin-cta-gradient text-white' : 'bg-white/5 text-slate-300'
            }`}
          >
            Communities ({filteredComms.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('people')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold ${
              tab === 'people' ? 'blin-cta-gradient text-white' : 'bg-white/5 text-slate-300'
            }`}
          >
            Real Members ({filteredPeople.length})
          </button>
        </div>
      </div>

      {tab === 'communities' ? (
        filteredComms.length === 0 ? (
          <div className="blin-surface rounded-3xl p-10 text-center space-y-3">
            <Users className="w-8 h-8 text-cyan-300 mx-auto" />
            <h3 className="font-display font-bold text-lg text-white">No Communities Created Yet</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Start the very first real community on BLiN for music, coding, photography, faith, or
              your local circle!
            </p>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="px-5 py-2.5 rounded-xl blin-cta-gradient text-white text-xs font-semibold"
            >
              Create First Community
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredComms.map((c) => {
              const joined = c.memberIds.includes(user.id);
              return (
                <div
                  key={c.id}
                  className="blin-surface rounded-2xl p-4 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${c.avatarGradient} flex items-center justify-center font-display font-bold text-white shrink-0`}
                    >
                      {c.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-display font-bold text-sm text-white truncate">{c.name}</p>
                      <p className="text-xs text-slate-400">
                        {c.memberIds.length} member{c.memberIds.length === 1 ? '' : 's'} ·{' '}
                        {c.category}
                      </p>
                      {c.description && (
                        <p className="text-xs text-slate-300 truncate mt-0.5">{c.description}</p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await apiRequest(`/api/communities/${c.id}/join`, { method: 'POST' });
                      await onRefreshAll();
                    }}
                    className={`min-h-[40px] px-4 rounded-xl text-xs font-semibold shrink-0 ${
                      joined
                        ? 'bg-white/10 text-cyan-200 border border-cyan-400/30'
                        : 'blin-cta-gradient text-white'
                    }`}
                  >
                    {joined ? 'Joined' : 'Join'}
                  </button>
                </div>
              );
            })}
          </div>
        )
      ) : (
        <div className="space-y-3">
          {filteredPeople.map((person) => (
            <div
              key={person.id}
              className="blin-surface rounded-2xl p-4 flex items-center justify-between gap-3"
            >
              <button
                type="button"
                onClick={() => onSelectUsername(person.username)}
                className="flex items-center gap-3 text-left min-w-0"
              >
                <UserAvatar
                  name={person.displayName}
                  avatarUrl={person.avatarUrl}
                  size="md"
                  isOnline={person.isOnline}
                />
                <div className="min-w-0">
                  <p className="font-display font-bold text-sm text-white truncate">
                    {person.displayName} {person.id === user.id && '(You)'}
                  </p>
                  <p className="text-xs text-slate-400 truncate">
                    @{person.username}
                    {person.pointsBalance !== null ? ` · ${person.pointsBalance} pts` : ''}
                  </p>
                </div>
              </button>

              {person.id !== user.id && (
                <button
                  type="button"
                  onClick={async () => {
                    await apiRequest(`/api/users/${person.id}/follow`, { method: 'POST' });
                    await onRefreshAll();
                  }}
                  className={`min-h-[40px] px-4 rounded-xl text-xs font-semibold ${
                    person.isFollowing
                      ? 'bg-white/10 text-white'
                      : person.hasRequestedFollow
                      ? 'bg-amber-500/20 text-amber-200'
                      : 'blin-cta-gradient text-white'
                  }`}
                >
                  {person.isFollowing
                    ? 'Following'
                    : person.hasRequestedFollow
                    ? 'Requested'
                    : 'Follow'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="blin-surface w-full max-w-md rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-lg text-white">Create Community</h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Community name (e.g. BLiN Creators)"
              className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#070B22] border border-white/10 text-sm text-white"
            />
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Category (e.g. Music, Coding, Faith, Sports)"
              className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#070B22] border border-white/10 text-sm text-white"
            />
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What brings your community together?"
              className="w-full p-3 rounded-xl bg-[#070B22] border border-white/10 text-sm text-white"
            />
            <button
              type="button"
              onClick={async () => {
                if (!name.trim()) return;
                await apiRequest('/api/communities', {
                  method: 'POST',
                  body: JSON.stringify({ name, category, description }),
                });
                setName('');
                setDescription('');
                setShowCreateModal(false);
                await onRefreshAll();
              }}
              className="w-full min-h-[44px] rounded-xl blin-cta-gradient text-white font-semibold text-xs"
            >
              Launch Community
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// COMPOSER MODAL (POST, SPOTLIGHT VIDEO, OR 24H STORY)
// =============================================================================
export function ComposerModal({
  user,
  mode,
  onClose,
  onPublished,
}: {
  user: UserAccount;
  mode: 'post' | 'spotlight' | 'story' | null;
  onClose: () => void;
  onPublished: () => Promise<void>;
}) {
  const [tab, setTab] = useState<'post' | 'spotlight' | 'story'>(mode || 'post');
  const [caption, setCaption] = useState('');
  const [topicsInput, setTopicsInput] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState<'none' | 'image' | 'video'>('none');
  const [audience, setAudience] = useState<'public' | 'followers' | 'private'>(
    user.settings.defaultUploadAudience
  );
  const [storyAudience, setStoryAudience] = useState<'everyone' | 'followers' | 'close_friends'>(
    user.settings.defaultStoryAudience
  );
  const [musicLabel, setMusicLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    if (mode) setTab(mode);
  }, [mode]);

  if (!mode) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="blin-surface w-full max-w-lg rounded-3xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-lg text-white">Create on BLiN</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 p-1 rounded-xl bg-[#070B22]">
          {(['post', 'spotlight', 'story'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setTab(m)}
              className={`py-2 rounded-lg text-xs font-semibold capitalize ${
                tab === m ? 'blin-cta-gradient text-white' : 'text-slate-400'
              }`}
            >
              {m === 'spotlight' ? 'Spotlight Video' : m === 'story' ? '24h Story' : 'Feed Post'}
            </button>
          ))}
        </div>

        <textarea
          rows={3}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder={
            tab === 'story'
              ? 'Share a moment or status...'
              : 'Write your caption (tag @friends or share an update)...'
          }
          className="w-full p-3.5 rounded-2xl bg-[#070B22] border border-blue-500/30 text-sm text-white"
        />

        <div className="flex items-center justify-between gap-3">
          <label className="min-h-[42px] px-4 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-cyan-200 flex items-center gap-2 cursor-pointer">
            <ImageIcon className="w-4 h-4" />
            <span>{mediaUrl ? 'Replace Media' : 'Attach Photo or Video'}</span>
            <input
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const url = await readFileAsDataUrl(file);
                setMediaUrl(url);
                setMediaType(file.type.startsWith('video/') ? 'video' : 'image');
              }}
            />
          </label>

          {tab === 'story' ? (
            <select
              value={storyAudience}
              onChange={(e) =>
                setStoryAudience(e.target.value as 'everyone' | 'followers' | 'close_friends')
              }
              className="min-h-[42px] px-3 rounded-xl bg-[#070B22] border border-white/10 text-xs text-white"
            >
              <option value="everyone">Audience: Everyone</option>
              <option value="followers">Audience: Followers</option>
              <option value="close_friends">Audience: Close Friends ★</option>
            </select>
          ) : (
            <select
              value={audience}
              onChange={(e) => setAudience(e.target.value as 'public' | 'followers' | 'private')}
              className="min-h-[42px] px-3 rounded-xl bg-[#070B22] border border-white/10 text-xs text-white"
            >
              <option value="public">Audience: Public</option>
              <option value="followers">Audience: Followers Only</option>
              <option value="private">Audience: Only Me</option>
            </select>
          )}
        </div>

        {tab !== 'story' ? (
          <input
            type="text"
            value={topicsInput}
            onChange={(e) => setTopicsInput(e.target.value)}
            placeholder="Topics separated by commas (e.g. Music, Tech, Photography)"
            className="w-full min-h-[40px] px-3.5 rounded-xl bg-[#070B22] border border-white/10 text-xs text-white"
          />
        ) : (
          <input
            type="text"
            value={musicLabel}
            onChange={(e) => setMusicLabel(e.target.value)}
            placeholder="Optional licensed music or sound credit"
            className="w-full min-h-[40px] px-3.5 rounded-xl bg-[#070B22] border border-white/10 text-xs text-white"
          />
        )}

        {tab === 'spotlight' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              value={musicLabel}
              onChange={(e) => setMusicLabel(e.target.value)}
              placeholder={`Audio Track (e.g. Original sound - ${user.displayName})`}
              className="w-full min-h-[40px] px-3.5 rounded-xl bg-[#070B22] border border-white/10 text-xs text-white"
            />
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#070B22] border border-white/10 text-xs text-slate-300">
              <span className="text-[11px] text-slate-400">Duration:</span>
              <span className="font-bold text-cyan-300">0:28 Vertical Reel</span>
            </div>
          </div>
        )}

        <button
          type="button"
          disabled={submitting || (!caption.trim() && !mediaUrl)}
          onClick={async () => {
            setSubmitting(true);
            try {
              if (tab === 'story') {
                await apiRequest('/api/stories', {
                  method: 'POST',
                  body: JSON.stringify({
                    text: caption,
                    mediaUrl,
                    musicLabel,
                    audience: storyAudience,
                  }),
                });
              } else {
                await apiRequest('/api/posts', {
                  method: 'POST',
                  body: JSON.stringify({
                    kind: tab === 'spotlight' ? 'spotlight' : 'feed',
                    postType: tab === 'spotlight' ? 'spotlight_reel' : 'feed',
                    caption,
                    mediaUrl,
                    mediaType: tab === 'spotlight' && mediaType === 'none' ? 'video' : mediaType,
                    aspectRatio: tab === 'spotlight' ? 'vertical' : 'standard',
                    audioAttribution: tab === 'spotlight' ? (musicLabel || `Original sound - ${user.displayName}`) : undefined,
                    videoDuration: tab === 'spotlight' ? '0:28' : undefined,
                    audience,
                    topics: topicsInput
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  }),
                });
              }
              await onPublished();
              onClose();
            } finally {
              setSubmitting(false);
            }
          }}
          className="w-full min-h-[46px] rounded-xl blin-cta-gradient text-white font-display font-bold text-sm disabled:opacity-40"
        >
          {submitting ? 'Publishing...' : `Publish ${tab === 'story' ? '24h Story' : tab === 'spotlight' ? 'Spotlight Reel' : 'Feed Post'}`}
        </button>
      </div>
    </div>
  );
}
