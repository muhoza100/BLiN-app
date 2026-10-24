import React, { useState, useEffect, useRef } from 'react';
import {
  Home,
  MessageCircle,
  Users,
  Compass,
  User,
  Plus,
  Radio,
  ShieldCheck,
  Settings,
  Sparkles,
  Award,
  LogOut,
  ChevronRight,
  Bell,
  Zap,
  Gamepad2,
  Film,
  MapPin,
} from 'lucide-react';
import {
  UserAccount,
  PublicUserSummary,
  PostItem,
  StoryItem,
  CommunityItem,
  VoiceRoomItem,
} from './types/blin';
import { apiRequest, getStoredToken, setStoredToken } from './lib/api';
import { BlinLogo, UserAvatar } from './components/BlinLogo';
import { AuthView } from './components/AuthView';
import {
  FeedSection,
  CommunitiesSection,
  ComposerModal,
  EnrichedPost,
} from './components/FeedAndSpotlight';
import { SpotlightReels } from './components/SpotlightReels';
import { MessagingHub, EnrichedConversation } from './components/MessagingHub';
import { VoiceRoomHub } from './components/VoiceRoomHub';
import { SecurityCenter } from './components/SecurityCenter';
import { SettingsHub } from './components/SettingsHub';
import { DiscoverHub } from './components/DiscoverHub';
import { StreetSmartAI } from './components/StreetSmartAI';
import { CyberRunnerGame } from './components/CyberRunnerGame';
import { AiVideoStudioModal } from './components/AiVideoStudioModal';
import { CityRadarMapsModal } from './components/CityRadarMapsModal';
import { testConnection } from './lib/firebase';

type MainTab =
  | 'home'
  | 'chat'
  | 'communities'
  | 'discover'
  | 'profile'
  | 'reels'
  | 'voice'
  | 'security'
  | 'settings'
  | 'ai';

// Custom Snapchat-style triangle icon inspired by uploaded reference image_1b505a71.png
function SnapTriangleIcon({ active = false }: { active?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`w-5 h-5 transition-transform ${active ? 'scale-110 drop-shadow-[0_0_8px_rgba(236,72,153,0.7)]' : ''}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? '2.5' : '2'}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon
        points="6 4 20 12 6 20 6 4"
        fill={active ? 'url(#snapTriangleGrad)' : 'none'}
        stroke={active ? '#EC4899' : 'currentColor'}
      />
      <circle cx="6" cy="12" r="1.3" fill={active ? '#06B6D4' : 'currentColor'} />
      <defs>
        <linearGradient id="snapTriangleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#EC4899" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [activeTab, setActiveTab] = useState<MainTab>('home');
  const [composerMode, setComposerMode] = useState<'post' | 'spotlight' | 'story' | null>(null);
  const [showAiModal, setShowAiModal] = useState(false);
  const [showGame, setShowGame] = useState(false);
  const [showVideoStudio, setShowVideoStudio] = useState(false);
  const [showCityRadar, setShowCityRadar] = useState(false);
  const [genzTheme, setGenzTheme] = useState<'acid' | 'chrome' | 'sunset' | 'matrix'>('acid');
  const [showThemePicker, setShowThemePicker] = useState(false);

  // Applet state
  const [posts, setPosts] = useState<EnrichedPost[]>([]);
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [communities, setCommunities] = useState<CommunityItem[]>([]);
  const [allUsers, setAllUsers] = useState<PublicUserSummary[]>([]);
  const [conversations, setConversations] = useState<EnrichedConversation[]>([]);
  const [voiceRooms, setVoiceRooms] = useState<VoiceRoomItem[]>([]);
  const [typingMap, setTypingMap] = useState<Record<string, string[]>>({});
  const [unreadTotal, setUnreadTotal] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);

  // Check existing session & verify Firestore connection
  useEffect(() => {
    async function initAuth() {
      testConnection(); // verify Firestore connection on startup
      const token = getStoredToken();
      if (!token) {
        setAuthChecking(false);
        return;
      }
      try {
        const user = await apiRequest<UserAccount>('/api/auth/me');
        setCurrentUser(user);
      } catch (err) {
        setStoredToken(null);
        setCurrentUser(null);
      } finally {
        setAuthChecking(false);
      }
    }
    initAuth();
  }, []);

  // Fetch all app data
  async function refreshAppData() {
    if (!currentUser) return;
    try {
      const [
        postsRes,
        storiesRes,
        commsRes,
        usersRes,
        convsRes,
        voiceRes,
        meRes,
      ] = await Promise.all([
        apiRequest<EnrichedPost[]>('/api/posts'),
        apiRequest<StoryItem[]>('/api/stories'),
        apiRequest<CommunityItem[]>('/api/communities'),
        apiRequest<PublicUserSummary[]>('/api/users'),
        apiRequest<EnrichedConversation[]>('/api/conversations'),
        apiRequest<VoiceRoomItem[]>('/api/voicerooms'),
        apiRequest<UserAccount>('/api/auth/me'),
      ]);

      setPosts(postsRes);
      setStories(storiesRes);
      setCommunities(commsRes);
      setAllUsers(usersRes);
      setConversations(convsRes);
      setVoiceRooms(voiceRes);
      setCurrentUser(meRes);

      const unread = convsRes.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
      setUnreadTotal(unread);
    } catch (err) {
      console.error('Error refreshing BLiN data', err);
    }
  }

  useEffect(() => {
    if (currentUser) {
      refreshAppData();
    }
  }, [currentUser?.id]);

  // WebSocket real-time connection
  useEffect(() => {
    if (!currentUser) return;
    const token = getStoredToken();
    if (!token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?token=${token}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // Dispatch event for components listening to real-time socket events
        window.dispatchEvent(new CustomEvent('blin:ws', { detail: data }));

        if (data.type === 'message:created' || data.type === 'conversation:updated') {
          refreshAppData();
        } else if (data.type === 'typing:update') {
          setTypingMap((prev) => ({
            ...prev,
            [data.conversationId]: data.users || [],
          }));
        } else if (
          data.type === 'voiceroom:state' ||
          data.type === 'voiceroom:chat' ||
          data.type === 'voiceroom:joined' ||
          data.type === 'voiceroom:left' ||
          data.type === 'voiceroom:created' ||
          data.type === 'voiceroom:destroyed' ||
          data.type === 'voiceroom:ended' ||
          data.type === 'voiceroom:list_update'
        ) {
          refreshAppData();
        } else if (data.type === 'points:updated') {
          refreshAppData();
        }
      } catch (e) {
        // ignore non-json ws packets
      }
    };

    return () => {
      ws.close();
    };
  }, [currentUser?.id]);

  function sendWebSocketEvent(event: string, payload: any) {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: event, ...payload }));
    }
  }

  function handleLogout() {
    setStoredToken(null);
    setCurrentUser(null);
    if (wsRef.current) wsRef.current.close();
  }

  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#050816] flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl blin-cta-gradient animate-spin flex items-center justify-center p-1">
            <div className="w-full h-full rounded-xl bg-[#050816]" />
          </div>
          <span className="font-display font-bold text-sm tracking-wider text-slate-400">
            CONNECTING TO BLiN...
          </span>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthView onAuthenticated={(user) => setCurrentUser(user)} />;
  }

  // Reels list
  const reelsList = posts.filter(
    (p) => p.postType === 'spotlight_reel' || (p.mediaType === 'video' && p.aspectRatio === 'vertical')
  );

  const themeClass =
    genzTheme === 'acid'
      ? 'genz-background'
      : genzTheme === 'chrome'
      ? 'theme-y2k-chrome'
      : genzTheme === 'sunset'
      ? 'theme-sunset-rave'
      : 'theme-matrix-mint';

  return (
    <div className={`min-h-screen ${themeClass} text-slate-100 flex flex-col justify-between selection:bg-pink-500/30 selection:text-white relative overflow-x-hidden transition-all duration-700`}>
      {/* Gen Z Ambient Kinetic Glow Orbs & Film Grain */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-32 -left-32 w-[420px] h-[420px] rounded-full bg-gradient-to-tr from-pink-500/25 to-purple-600/20 blur-[110px] animate-pulse" />
        <div
          className="absolute top-1/4 -right-32 w-[400px] h-[400px] rounded-full bg-gradient-to-br from-violet-600/25 to-cyan-500/20 blur-[120px] animate-pulse"
          style={{ animationDelay: '2s' }}
        />
        <div
          className="absolute -bottom-32 left-1/3 w-[460px] h-[460px] rounded-full bg-gradient-to-tr from-cyan-500/20 via-pink-500/20 to-violet-600/20 blur-[130px] animate-pulse"
          style={{ animationDelay: '3.5s' }}
        />
        <div className="absolute inset-0 genz-grain-overlay opacity-30" />
      </div>

      {/* =========================================================================
          TOP APP HEADER (Matches uploaded reference with Discover, Reels & Street AI)
         ========================================================================= */}
      <header className="sticky top-0 z-30 w-full bg-[#060512]/80 backdrop-blur-2xl border-b border-white/[0.08] px-3 sm:px-6 py-2.5 transition-colors">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2 sm:gap-4 relative z-10">
          {/* Logo & Tagline */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('home')}
              className="flex items-center gap-2.5 hover:opacity-90 transition-opacity"
            >
              <BlinLogo size="sm" showWordmark={true} />
            </button>
            <span className="hidden lg:inline-block text-[11px] text-slate-400 border-l border-white/10 pl-3">
              Blend in. Be yourself.
            </span>
          </div>

          {/* CENTER TABS: "For You" (Home) vs "Discover" vs "Reels" */}
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('home')}
              className={`relative px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-bold transition-all rounded-full ${
                activeTab === 'home'
                  ? 'text-white font-extrabold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>For You</span>
              {activeTab === 'home' && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full blin-cta-gradient" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('discover')}
              className={`relative px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-bold transition-all rounded-full flex items-center gap-1.5 ${
                activeTab === 'discover'
                  ? 'text-white font-extrabold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Compass className="w-3.5 h-3.5 text-cyan-300" />
              <span>Discover</span>
              {activeTab === 'discover' && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-cyan-400" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('reels')}
              className={`relative px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-bold transition-all rounded-full flex items-center gap-1.5 ${
                activeTab === 'reels'
                  ? 'text-white font-extrabold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <SnapTriangleIcon active={activeTab === 'reels'} />
              <span>Reels</span>
              {activeTab === 'reels' && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full blin-reels-gradient" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('voice')}
              className={`hidden sm:flex relative px-3 py-1.5 text-xs sm:text-sm font-bold transition-all rounded-full items-center gap-1.5 ${
                activeTab === 'voice'
                  ? 'text-white font-extrabold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Radio className="w-3.5 h-3.5 text-pink-400" />
              <span>Voice</span>
              {voiceRooms.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-pink-500 animate-ping" />
              )}
            </button>
          </div>

          {/* RIGHT ACTION ICONS: Street Smart AI, Points, Bell, Profile */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Gen Z Vibe Switcher */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowThemePicker((p) => !p)}
                className="px-2.5 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center gap-1.5 text-xs font-bold text-pink-300 transition-colors"
                title="Switch Gen Z Vibe"
              >
                <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                <span className="hidden md:inline capitalize">{genzTheme} Vibe</span>
              </button>

              {showThemePicker && (
                <div className="absolute right-0 top-11 w-48 rounded-2xl bg-[#0a061c]/95 backdrop-blur-2xl border border-white/15 p-2 shadow-2xl z-50 space-y-1 text-xs">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1">
                    Gen Z Aesthetic Vibes
                  </p>
                  {[
                    { id: 'acid', name: '⚡ Acid Cyber', desc: 'Magenta + Neon Cyan' },
                    { id: 'chrome', name: '🪞 Y2K Chrome', desc: 'Silver Violet + Blue' },
                    { id: 'sunset', name: '🌅 Sunset Rave', desc: 'Coral + Electric Violet' },
                    { id: 'matrix', name: '🧪 Matrix Mint', desc: 'Cyber Lime + Teal' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setGenzTheme(t.id as any);
                        setShowThemePicker(false);
                      }}
                      className={`w-full text-left p-2 rounded-xl transition-colors ${
                        genzTheme === t.id
                          ? 'bg-gradient-to-r from-pink-500/25 to-violet-600/30 text-white font-bold border border-pink-500/30'
                          : 'hover:bg-white/10 text-slate-300'
                      }`}
                    >
                      <p className="text-xs">{t.name}</p>
                      <p className="text-[10px] text-slate-400">{t.desc}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Cyber Runner Arcade Game Launcher */}
            <button
              type="button"
              onClick={() => setShowGame(true)}
              className="px-2.5 py-1.5 rounded-full bg-gradient-to-r from-pink-500/20 to-purple-600/30 hover:from-pink-500/30 hover:to-purple-600/40 border border-pink-500/40 flex items-center gap-1.5 text-xs font-bold text-pink-300 shadow-md transition-all active:scale-95"
              title="Play Cyber Runner Arcade"
            >
              <Gamepad2 className="w-3.5 h-3.5 text-pink-400" />
              <span className="hidden sm:inline">Arcade</span>
            </button>

            {/* Omni Flash Video Studio Launcher */}
            <button
              type="button"
              onClick={() => setShowVideoStudio(true)}
              className="px-2.5 py-1.5 rounded-full bg-gradient-to-r from-purple-600/20 to-cyan-500/20 hover:from-purple-600/30 hover:to-cyan-500/30 border border-cyan-400/40 flex items-center gap-1.5 text-xs font-bold text-cyan-300 shadow-md transition-all active:scale-95"
              title="Omni Flash Video Studio"
            >
              <Film className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden md:inline">AI Video</span>
            </button>

            {/* City Radar (Google Maps Grounding) Launcher */}
            <button
              type="button"
              onClick={() => setShowCityRadar(true)}
              className="px-2.5 py-1.5 rounded-full bg-white/5 hover:bg-cyan-500/20 border border-white/10 hover:border-cyan-400/40 flex items-center gap-1.5 text-xs font-bold text-cyan-300 transition-all active:scale-95"
              title="City Radar (Google Maps Grounding)"
            >
              <MapPin className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden lg:inline">City Radar</span>
            </button>

            {/* Street-Smart AI Button */}
            <button
              type="button"
              onClick={() => setActiveTab('ai')}
              className={`px-3 py-1.5 rounded-full border flex items-center gap-1.5 text-xs font-bold transition-all ${
                activeTab === 'ai'
                  ? 'bg-gradient-to-r from-violet-600 to-pink-600 border-pink-400/50 text-white shadow-lg shadow-pink-500/25'
                  : 'bg-white/5 hover:bg-violet-600/20 border-white/10 hover:border-violet-500/30 text-cyan-200'
              }`}
              title="Ace · Street-Smart AI"
            >
              <Zap className="w-3.5 h-3.5 text-pink-400 animate-pulse" />
              <span className="hidden sm:inline">Ace AI</span>
            </button>

            {/* Live Authoritative BLiN Points Badge */}
            <button
              type="button"
              onClick={() => setActiveTab('security')}
              className="px-2.5 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center gap-1.5 text-xs font-bold text-cyan-300 transition-colors"
              title="BLiN Points & Security Ledger"
            >
              <Award className="w-3.5 h-3.5 text-cyan-400" />
              <span className="tabular-nums">{currentUser.pointsBalance}</span>
            </button>

            {/* Notification Bell */}
            <button
              type="button"
              onClick={() => setActiveTab('security')}
              className="relative w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300 transition-colors"
              title="Security & Activity Alerts"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-pink-500 text-white text-[10px] font-bold flex items-center justify-center">
                3
              </span>
            </button>

            {/* Profile Avatar with Online Status */}
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className="relative p-0.5 rounded-full border border-white/20 hover:border-violet-400 transition-colors"
              title="My Profile & Settings"
            >
              <UserAvatar
                name={currentUser.displayName}
                avatarUrl={currentUser.avatarUrl}
                size="sm"
                isOnline={true}
              />
            </button>
          </div>
        </div>
      </header>

      {/* =========================================================================
          MAIN BODY VIEW (Distinct Home Feed vs Discover vs Reels vs Hubs)
         ========================================================================= */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-3 sm:px-6 py-4 pb-24">
        {/* VIEW 1: HOME FEED (DISTINCT SOCIAL FEED, NOT REELS) */}
        {activeTab === 'home' && (
          <div className="space-y-6">
            {/* Reels, Discover & Street Smart AI Top Jump Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div
                onClick={() => setActiveTab('reels')}
                className="blin-surface rounded-2xl p-4 flex items-center justify-between cursor-pointer group hover:border-pink-500/40 transition-colors shadow-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl blin-reels-gradient flex items-center justify-center text-white shadow-md">
                    <SnapTriangleIcon active={true} />
                  </div>
                  <div>
                    <h2 className="font-display font-bold text-sm text-white flex items-center gap-1.5">
                      BLiN Reels
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-pink-500/20 text-pink-300 font-mono">
                        {reelsList.length}
                      </span>
                    </h2>
                    <p className="text-xs text-slate-400">
                      Snap-style vertical video reels
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-pink-400 transition-colors" />
              </div>

              <div
                onClick={() => setActiveTab('discover')}
                className="blin-surface rounded-2xl p-4 flex items-center justify-between cursor-pointer group hover:border-cyan-500/40 transition-colors shadow-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-md">
                    <Compass className="w-5 h-5 group-hover:rotate-45 transition-transform" />
                  </div>
                  <div>
                    <h2 className="font-display font-bold text-sm text-white flex items-center gap-1.5">
                      Discover
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300">
                        Trends
                      </span>
                    </h2>
                    <p className="text-xs text-slate-400">
                      Breakout creators & topics
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-cyan-400 transition-colors" />
              </div>

              <div
                onClick={() => setActiveTab('ai')}
                className="blin-surface rounded-2xl p-4 flex items-center justify-between cursor-pointer group hover:border-violet-500/40 transition-colors shadow-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-pink-500 via-violet-600 to-cyan-400 flex items-center justify-center text-white shadow-md">
                    <Zap className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  </div>
                  <div>
                    <h2 className="font-display font-bold text-sm text-white flex items-center gap-1.5">
                      Street-Smart AI
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-pink-500/20 text-pink-300">
                        Ace
                      </span>
                    </h2>
                    <p className="text-xs text-slate-400">
                      Real talk, scam check & captions
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-violet-400 transition-colors" />
              </div>
            </div>

            {/* Second Row: Arcade Game, Omni Flash Video & Google Maps City Radar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div
                onClick={() => setShowGame(true)}
                className="blin-surface rounded-2xl p-4 flex items-center justify-between cursor-pointer group hover:border-pink-500/50 transition-colors shadow-lg bg-gradient-to-br from-pink-500/10 via-transparent to-transparent"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl blin-cta-gradient flex items-center justify-center text-white shadow-md">
                    <Gamepad2 className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                  </div>
                  <div>
                    <h2 className="font-display font-bold text-sm text-white flex items-center gap-1.5">
                      Cyber Runner
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-pink-500/20 text-pink-300 font-mono">
                        Arcade
                      </span>
                    </h2>
                    <p className="text-xs text-slate-400">
                      60FPS synth game · Earn points
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-pink-400 transition-colors" />
              </div>

              <div
                onClick={() => setShowVideoStudio(true)}
                className="blin-surface rounded-2xl p-4 flex items-center justify-between cursor-pointer group hover:border-cyan-500/50 transition-colors shadow-lg bg-gradient-to-br from-cyan-500/10 via-transparent to-transparent"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-cyan-500 flex items-center justify-center text-white shadow-md">
                    <Film className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  </div>
                  <div>
                    <h2 className="font-display font-bold text-sm text-white flex items-center gap-1.5">
                      Omni Flash Video
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono">
                        AI Video
                      </span>
                    </h2>
                    <p className="text-xs text-slate-400">
                      Text-to-Video for Reels (Interactions)
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-cyan-400 transition-colors" />
              </div>

              <div
                onClick={() => setShowCityRadar(true)}
                className="blin-surface rounded-2xl p-4 flex items-center justify-between cursor-pointer group hover:border-blue-500/50 transition-colors shadow-lg bg-gradient-to-br from-blue-500/10 via-transparent to-transparent"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-md">
                    <MapPin className="w-5 h-5 group-hover:bounce transition-transform" />
                  </div>
                  <div>
                    <h2 className="font-display font-bold text-sm text-white flex items-center gap-1.5">
                      City Radar
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-mono">
                        Google Maps
                      </span>
                    </h2>
                    <p className="text-xs text-slate-400">
                      Scout real-world creator hangouts
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-blue-400 transition-colors" />
              </div>
            </div>

            {/* Homepage Feed Section (Rich posts, photos, discussions) */}
            <FeedSection
              user={currentUser}
              posts={posts}
              stories={stories}
              onRefreshAll={refreshAppData}
              onOpenComposer={(mode) => setComposerMode(mode)}
              onSelectUsername={(uname) => {
                const found = allUsers.find((u) => u.username === uname);
                if (found) setActiveTab('communities');
              }}
              onOpenFeedSettings={() => setActiveTab('settings')}
            />
          </div>
        )}

        {/* VIEW 2: DISCOVER HUB (SNAPCHAT-STYLE DISCOVER) */}
        {activeTab === 'discover' && (
          <DiscoverHub
            user={currentUser}
            onNavigateToReels={() => setActiveTab('reels')}
            onNavigateToVoice={() => setActiveTab('voice')}
            onSelectCreator={(uname) => setActiveTab('communities')}
            onRefreshAll={refreshAppData}
          />
        )}

        {/* VIEW 3: REELS (FULL VERTICAL IMMERSION, PLACED AFTER PROFILE) */}
        {activeTab === 'reels' && (
          <SpotlightReels
            user={currentUser}
            reels={posts}
            allUsers={allUsers}
            onRefreshAll={refreshAppData}
            onOpenComposer={() => setComposerMode('spotlight')}
            onSelectUsername={(uname) => {
              const found = allUsers.find((u) => u.username === uname);
              if (found) setActiveTab('communities');
            }}
            onNavigateHome={() => setActiveTab('home')}
          />
        )}

        {/* VIEW 4: STREET-SMART AI (POWERED BY GEMINI 3.8 FLASH) */}
        {activeTab === 'ai' && <StreetSmartAI user={currentUser} />}

        {/* VIEW 5: LIVE VOICE ROOMS */}
        {activeTab === 'voice' && (
          <VoiceRoomHub
            user={currentUser}
            rooms={voiceRooms}
            allUsers={allUsers}
            onRefreshAll={refreshAppData}
            onSelectUsername={(uname) => {
              const found = allUsers.find((u) => u.username === uname);
              if (found) setActiveTab('communities');
            }}
            sendWebSocketEvent={sendWebSocketEvent}
          />
        )}

        {/* VIEW 6: MESSAGING HUB (WITH PINNED STREET-SMART AI ROW) */}
        {activeTab === 'chat' && (
          <MessagingHub
            user={currentUser}
            conversations={conversations}
            allUsers={allUsers}
            typingMap={typingMap}
            onRefreshConversations={refreshAppData}
            onSendTyping={(cid, active) => {
              sendWebSocketEvent(active ? 'typing:start' : 'typing:stop', {
                conversationId: cid,
              });
            }}
            onOpenSettingsCategory={() => setActiveTab('settings')}
            onOpenStreetAI={() => setActiveTab('ai')}
          />
        )}

        {/* VIEW 7: COMMUNITY AREA (GROUPS, DISCUSSIONS, REAL MEMBER DIRECTORY) */}
        {activeTab === 'communities' && (
          <CommunitiesSection
            user={currentUser}
            communities={communities}
            allUsers={allUsers}
            onRefreshAll={refreshAppData}
            onSelectUsername={(uname) => {
              setActiveTab('chat');
            }}
          />
        )}

        {/* VIEW 8: SECURITY & PRIVACY CENTER */}
        {activeTab === 'security' && (
          <SecurityCenter
            user={currentUser}
            onRefreshAll={refreshAppData}
            onUserUpdated={(u) => setCurrentUser(u)}
            onLogout={handleLogout}
          />
        )}

        {/* VIEW 9: 100+ SETTINGS HUB */}
        {activeTab === 'settings' && (
          <SettingsHub
            user={currentUser}
            storageMetrics={{
              postsAndMediaBytes: 4200000,
              chatsBytes: 1800000,
              profileAndSettingsBytes: 450000,
            }}
            allUsers={allUsers}
            myPosts={posts.filter((p) => p.authorId === currentUser.id)}
            communities={communities}
            onUserUpdated={(u) => setCurrentUser(u)}
            onLogout={handleLogout}
            onOpenProfilePreview={() => setActiveTab('profile')}
          />
        )}

        {/* VIEW 10: USER PROFILE */}
        {activeTab === 'profile' && (
          <div className="space-y-6 max-w-3xl mx-auto">
            {/* Profile Header Card */}
            <div className="blin-surface rounded-3xl p-6 sm:p-8 space-y-6 border border-white/10 shadow-2xl relative overflow-hidden">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-pink-500 via-violet-500 to-cyan-400 shadow-xl">
                    <UserAvatar
                      name={currentUser.displayName}
                      avatarUrl={currentUser.avatarUrl}
                      size="xl"
                      isOnline={true}
                    />
                  </div>
                </div>

                <div className="flex-1 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h1 className="font-display font-extrabold text-2xl text-white">
                        {currentUser.displayName}
                      </h1>
                      <p className="text-xs text-cyan-300 font-semibold">@{currentUser.username}</p>
                    </div>

                    <div className="flex items-center justify-center sm:justify-start gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveTab('security')}
                        className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300 border border-white/10 flex items-center gap-1.5"
                      >
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        <span>Security</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('settings')}
                        className="px-3.5 py-1.5 rounded-xl blin-cta-gradient text-white text-xs font-semibold flex items-center gap-1.5 shadow-md"
                      >
                        <Settings className="w-4 h-4" />
                        <span>Settings</span>
                      </button>
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-300 max-w-lg leading-relaxed">
                    {currentUser.bio ||
                      'Authentic BLiN creator. Sharing ideas, discovering communities & keeping it real.'}
                  </p>

                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 pt-2 text-xs text-slate-400">
                    <span className="text-white font-bold">
                      {currentUser.followerIds.length}{' '}
                      <span className="text-slate-400 font-normal">Followers</span>
                    </span>
                    <span className="text-white font-bold">
                      {currentUser.followingIds.length}{' '}
                      <span className="text-slate-400 font-normal">Following</span>
                    </span>
                    <span className="text-cyan-300 font-bold flex items-center gap-1">
                      <Award className="w-4 h-4 text-cyan-400" />
                      {currentUser.pointsBalance} BLiN Points
                    </span>
                  </div>
                </div>
              </div>

              {/* Logout button */}
              <div className="pt-4 border-t border-white/10 flex justify-end">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-4 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 text-xs font-bold flex items-center gap-1.5 border border-rose-500/30"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log Out of BLiN</span>
                </button>
              </div>
            </div>

            {/* My Posts & Reels grid */}
            <div className="space-y-4">
              <h2 className="font-display font-bold text-lg text-white">My Authentic Content</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {posts
                  .filter((p) => p.authorId === currentUser.id)
                  .map((p) => (
                    <div
                      key={p.id}
                      className="rounded-2xl overflow-hidden bg-black/40 border border-white/10 aspect-square flex flex-col justify-between p-3 relative group"
                    >
                      {p.mediaUrl ? (
                        p.mediaType === 'video' ? (
                          <video src={p.mediaUrl} className="absolute inset-0 w-full h-full object-cover" />
                        ) : (
                          <img
                            src={p.mediaUrl}
                            alt="Post"
                            className="absolute inset-0 w-full h-full object-cover"
                          />
                        )
                      ) : (
                        <div className="absolute inset-0 blin-surface flex items-center justify-center p-3 text-center">
                          <p className="text-xs text-slate-200 line-clamp-3">{p.caption}</p>
                        </div>
                      )}
                      <div className="relative z-10 flex justify-between text-[10px] font-bold text-white bg-black/50 px-2 py-0.5 rounded-md backdrop-blur">
                        <span>{p.postType === 'spotlight_reel' ? '▶ Reel' : 'Feed'}</span>
                        <span>♥ {p.likeUserIds.length}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* =========================================================================
          BOTTOM NAVIGATION BAR (Reels AFTER Profile with Snapchat Triangle Icon!)
         ========================================================================= */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-[#050816]/95 backdrop-blur-xl border-t border-white/[0.08] px-2 sm:px-4 py-2">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          {/* 1. Home */}
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center gap-1 min-w-[44px] transition-colors ${
              activeTab === 'home' ? 'text-violet-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px]">Home</span>
          </button>

          {/* 2. Chat */}
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`relative flex flex-col items-center gap-1 min-w-[44px] transition-colors ${
              activeTab === 'chat' ? 'text-cyan-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageCircle className="w-5 h-5" />
            <span className="text-[10px]">Chat</span>
            {unreadTotal > 0 && (
              <span className="absolute -top-1 right-1 w-4 h-4 rounded-full bg-pink-500 text-white text-[9px] font-bold flex items-center justify-center">
                {unreadTotal}
              </span>
            )}
          </button>

          {/* 3. Community Area */}
          <button
            type="button"
            onClick={() => setActiveTab('communities')}
            className={`flex flex-col items-center gap-1 min-w-[44px] transition-colors ${
              activeTab === 'communities' ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-5 h-5" />
            <span className="text-[10px]">Community</span>
          </button>

          {/* 4. Floating '+' Create Button in Center */}
          <button
            type="button"
            onClick={() => setComposerMode('post')}
            className="w-11 h-11 -mt-4 rounded-full blin-cta-gradient flex items-center justify-center text-white shadow-xl shadow-purple-500/35 hover:scale-105 active:scale-95 transition-transform"
            title="Create Post or Reel"
          >
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </button>

          {/* 5. Discover */}
          <button
            type="button"
            onClick={() => setActiveTab('discover')}
            className={`flex flex-col items-center gap-1 min-w-[44px] transition-colors ${
              activeTab === 'discover' ? 'text-cyan-300 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Compass className="w-5 h-5" />
            <span className="text-[10px]">Discover</span>
          </button>

          {/* 6. Profile */}
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center gap-1 min-w-[44px] transition-colors ${
              activeTab === 'profile' ? 'text-violet-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-5 h-5" />
            <span className="text-[10px]">Profile</span>
          </button>

          {/* 7. REELS (PLACED AFTER PROFILE USING SNAPCHAT TRIANGLE ICON) */}
          <button
            type="button"
            onClick={() => setActiveTab('reels')}
            className={`flex flex-col items-center gap-1 min-w-[44px] transition-colors ${
              activeTab === 'reels' ? 'text-pink-400 font-bold' : 'text-slate-400 hover:text-pink-300'
            }`}
            title="BLiN Reels"
          >
            <SnapTriangleIcon active={activeTab === 'reels'} />
            <span className="text-[10px]">Reels</span>
          </button>
        </div>
      </nav>

      {/* COMPOSER MODAL (Feed Post vs Reel vs Story) */}
      <ComposerModal
        user={currentUser}
        mode={composerMode}
        onClose={() => setComposerMode(null)}
        onPublished={refreshAppData}
      />

      {/* 1. FULL-VIEWPORT INTERACTIVE GAME SHELL (CYBER RUNNER) */}
      {showGame && currentUser && (
        <CyberRunnerGame
          user={currentUser}
          onClose={() => setShowGame(false)}
          onPointsUpdated={refreshAppData}
        />
      )}

      {/* 2. GEMINI OMNI FLASH VIDEO STUDIO MODAL */}
      {showVideoStudio && currentUser && (
        <AiVideoStudioModal
          user={currentUser}
          onClose={() => setShowVideoStudio(false)}
          onVideoPublished={refreshAppData}
        />
      )}

      {/* 3. GOOGLE MAPS GROUNDING CITY RADAR MODAL */}
      {showCityRadar && currentUser && (
        <CityRadarMapsModal
          user={currentUser}
          onClose={() => setShowCityRadar(false)}
        />
      )}
    </div>
  );
}
