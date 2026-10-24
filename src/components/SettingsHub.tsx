import React, { useState, useEffect, useMemo } from 'react';
import QRCode from 'qrcode';
import {
  Search,
  ChevronRight,
  ChevronLeft,
  User,
  Shield,
  Sliders,
  MessageSquare,
  Video,
  CircleDot,
  Bell,
  Palette,
  Lock,
  Users,
  Sparkles,
  Star,
  Cpu,
  HardDrive,
  HelpCircle,
  LogOut,
  QrCode,
  ArrowUp,
  ArrowDown,
  Check,
  Copy,
  Download,
  Plus,
  Trash2,
  Mic,
  Square,
  Volume2,
  Smartphone,
  Award,
  TrendingUp,
  AlertTriangle,
  Camera,
  Image as ImageIcon,
} from 'lucide-react';
import {
  UserAccount,
  BlinSettings,
  PublicUserSummary,
  PostItem,
  CommunityItem,
  SupportSubmission,
} from '../types/blin';
import {
  SETTINGS_CATEGORIES,
  ALL_BLIN_SETTINGS,
  SettingsCategoryId,
  FinderFilterTag,
  SettingItemSpec,
} from '../data/settingsRegistry';
import { getCreatorLevel } from '../data/defaultSettings';
import { UserAvatar, LegalModal } from './BlinLogo';
import { apiRequest, readFileAsDataUrl, formatBytes, formatRelativeTime } from '../lib/api';

interface SettingsHubProps {
  user: UserAccount;
  storageMetrics: {
    postsAndMediaBytes: number;
    chatsBytes: number;
    profileAndSettingsBytes: number;
  };
  allUsers: PublicUserSummary[];
  myPosts: PostItem[];
  communities: CommunityItem[];
  onUserUpdated: (user: UserAccount) => void;
  onLogout: () => void;
  onOpenProfilePreview: (previewMode: 'public' | 'follower' | 'friend') => void;
  initialCategory?: SettingsCategoryId | null;
}

const FINDER_TAGS: FinderFilterTag[] = [
  'All',
  'Account',
  'Feed',
  'Messaging',
  'Privacy',
  'Creator',
  'AI',
  'Security',
  'Appearance',
  'Data',
  'Notifications',
];

function getCategoryIcon(cat: SettingsCategoryId) {
  switch (cat) {
    case 'account':
      return <User className="w-5 h-5 text-violet-300" />;
    case 'privacy':
      return <Shield className="w-5 h-5 text-cyan-300" />;
    case 'feed':
      return <Sliders className="w-5 h-5 text-blue-300" />;
    case 'messaging':
      return <MessageSquare className="w-5 h-5 text-indigo-300" />;
    case 'spotlight':
      return <Video className="w-5 h-5 text-fuchsia-300" />;
    case 'stories':
      return <CircleDot className="w-5 h-5 text-pink-300" />;
    case 'notifications':
      return <Bell className="w-5 h-5 text-sky-300" />;
    case 'appearance':
      return <Palette className="w-5 h-5 text-purple-300" />;
    case 'security':
      return <Lock className="w-5 h-5 text-emerald-300" />;
    case 'communities':
      return <Users className="w-5 h-5 text-teal-300" />;
    case 'creator':
      return <TrendingUp className="w-5 h-5 text-amber-300" />;
    case 'points':
      return <Star className="w-5 h-5 text-yellow-300" />;
    case 'ai':
      return <Cpu className="w-5 h-5 text-cyan-300" />;
    case 'storage':
      return <HardDrive className="w-5 h-5 text-blue-300" />;
    case 'legal':
      return <HelpCircle className="w-5 h-5 text-slate-300" />;
  }
}

export function SettingsHub({
  user,
  storageMetrics,
  allUsers,
  myPosts,
  communities,
  onUserUpdated,
  onLogout,
  onOpenProfilePreview,
  initialCategory = null,
}: SettingsHubProps) {
  const [activeCategory, setActiveCategory] = useState<SettingsCategoryId | null>(initialCategory);
  const [searchQuery, setSearchQuery] = useState('');
  const [finderFilter, setFinderFilter] = useState<FinderFilterTag>('All');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Active sub-modal / tool drawer inside Settings
  const [activeTool, setActiveTool] = useState<SettingItemSpec['customActionId'] | null>(null);
  const [legalDoc, setLegalDoc] = useState<'terms' | 'privacy' | 'guidelines' | null>(null);

  // Personal Info Editor state
  const [editName, setEditName] = useState(user.displayName);
  const [editUsername, setEditUsername] = useState(user.username);
  const [editBio, setEditBio] = useState(user.bio);
  const [editLocation, setEditLocation] = useState(user.location);
  const [editWebsite, setEditWebsite] = useState(user.website);
  const [editPhone, setEditPhone] = useState(user.phone);
  const [editMood, setEditMood] = useState(user.moodStatus);

  // QR Code Data URL
  const [qrDataUrl, setQrDataUrl] = useState('');

  // Pronunciation Audio Recorder
  const [pronText, setPronText] = useState(user.settings.pronunciationText);
  const [recordingAudio, setRecordingAudio] = useState(false);
  const [recorderInstance, setRecorderInstance] = useState<MediaRecorder | null>(null);

  // Multiple Profiles creator
  const [newSubLabel, setNewSubLabel] = useState<'Creator' | 'Personal'>('Creator');
  const [newSubName, setNewSubName] = useState('');
  const [newSubUsername, setNewSubUsername] = useState('');
  const [newSubBio, setNewSubBio] = useState('');

  // Tag / Word inputs
  const [wordDraft, setWordDraft] = useState('');
  const [topicDraft, setTopicDraft] = useState('');

  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Privacy Wizard step
  const [wizardStep, setWizardStep] = useState(0);

  // Leaderboard state
  const [lbPeriod, setLbPeriod] = useState<'weekly' | 'monthly'>('weekly');
  const [lbEntries, setLbEntries] = useState<
    {
      userId: string;
      displayName: string;
      username: string;
      avatarUrl: string;
      verified: boolean;
      totalPoints: number;
      periodPoints: number;
      creatorLevel: string;
    }[]
  >([]);

  // Points interactive calculator in BLiN Points screen
  const [calcLikes, setCalcLikes] = useState(100);
  const [calcFollowers, setCalcFollowers] = useState(50);

  // Support / Dispute form
  const [ticketType, setTicketType] = useState<SupportSubmission['type']>('bug');
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketDetails, setTicketDetails] = useState('');
  const [myTickets, setMyTickets] = useState<SupportSubmission[]>([]);

  // Delete confirmation input
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  useEffect(() => {
    if (initialCategory !== undefined) {
      setActiveCategory(initialCategory);
    }
  }, [initialCategory]);

  useEffect(() => {
    setEditName(user.displayName);
    setEditUsername(user.username);
    setEditBio(user.bio);
    setEditLocation(user.location);
    setEditWebsite(user.website);
    setEditPhone(user.phone);
    setEditMood(user.moodStatus);
    setPronText(user.settings.pronunciationText);
  }, [user]);

  function notify(msg: string) {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 2800);
  }

  async function updateSettings(patch: Partial<BlinSettings>, feedback?: string) {
    try {
      const res = await apiRequest<{ user: UserAccount }>('/api/me/settings', {
        method: 'PATCH',
        body: JSON.stringify({ settings: patch }),
      });
      onUserUpdated(res.user);
      if (feedback) notify(feedback);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not save setting');
    }
  }

  async function updateProfile(patch: Record<string, unknown>, feedback?: string) {
    try {
      const res = await apiRequest<{ user: UserAccount }>('/api/me/profile', {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      onUserUpdated(res.user);
      if (feedback) notify(feedback);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not update profile');
    }
  }

  // Generate QR Code whenever QR modal opens
  useEffect(() => {
    if (activeTool !== 'open_qr_modal') return;
    const url = `${window.location.origin}/?profile=${encodeURIComponent(user.username)}`;
    QRCode.toDataURL(url, {
      width: 280,
      margin: 2,
      color: { dark: '#070A1E', light: '#FFFFFF' },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
  }, [activeTool, user.username]);

  // Load Leaderboard when opened or when Points category is active
  useEffect(() => {
    if (activeCategory !== 'points' && activeTool !== 'open_leaderboard') return;
    apiRequest<{ entries: typeof lbEntries }>(`/api/leaderboard?period=${lbPeriod}`)
      .then((res) => setLbEntries(res.entries))
      .catch(() => setLbEntries([]));
  }, [activeCategory, activeTool, lbPeriod]);

  // Load Support tickets when needed
  useEffect(() => {
    if (activeTool !== 'open_support_ticket' && activeTool !== 'open_points_dispute') return;
    apiRequest<{ submissions: SupportSubmission[] }>('/api/support')
      .then((res) => setMyTickets(res.submissions))
      .catch(() => setMyTickets([]));
  }, [activeTool]);

  async function triggerCustomAction(actionId: SettingItemSpec['customActionId']) {
    if (!actionId) return;
    if (actionId === 'open_terms') {
      setLegalDoc('terms');
      return;
    }
    if (actionId === 'open_privacy_policy') {
      setLegalDoc('privacy');
      return;
    }
    if (actionId === 'open_guidelines') {
      setLegalDoc('guidelines');
      return;
    }
    if (actionId === 'export_all_data' || actionId === 'export_identity') {
      try {
        const archive = await apiRequest<Record<string, unknown>>('/api/me/export');
        const payload =
          actionId === 'export_identity'
            ? {
                exportedAt: archive.exportedAt,
                profile: archive.profile,
                blinPoints: archive.blinPoints,
              }
            : archive;
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `blin-${actionId === 'export_identity' ? 'identity' : 'data'}-${user.username}.json`;
        a.click();
        URL.revokeObjectURL(url);
        notify('Downloaded portable JSON archive');
      } catch {
        notify('Could not export archive');
      }
      return;
    }
    if (actionId === 'reset_feed_interests') {
      const res = await apiRequest<{ user: UserAccount }>('/api/me/reset-interests', {
        method: 'POST',
      });
      onUserUpdated(res.user);
      notify('Feed recommendation preferences reset');
      return;
    }
    if (actionId === 'clear_ai_personalization') {
      await updateSettings(
        {
          aiMemoryEnabled: false,
          aiCaptionAndBioAssist: false,
          aiVideoIdeaSuggestions: false,
          aiContentPlanningAssist: false,
        },
        'Cleared AI personalization preferences'
      );
      return;
    }
    if (actionId === 'logout_other_devices') {
      const res = await apiRequest<{ user: UserAccount }>('/api/auth/logout-all-other', {
        method: 'POST',
      });
      onUserUpdated(res.user);
      notify('Logged out of all other devices');
      return;
    }
    if (actionId === 'clear_chat_history') {
      await apiRequest('/api/me/chat-history', { method: 'DELETE' });
      notify('Cleared direct conversation message history');
      return;
    }
    if (actionId === 'open_points_dispute') {
      setTicketType('points_dispute');
      setTicketSubject('BLiN Points Balance / Milestone Audit Request');
    }
    setActiveTool(actionId);
  }

  // Filtered settings for Finder & Search
  const filteredSettings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return ALL_BLIN_SETTINGS.filter((item) => {
      if (finderFilter !== 'All' && item.finderTag !== finderFilter) return false;
      if (!q) return true;
      return (
        item.label.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.sectionTitle.toLowerCase().includes(q) ||
        item.keywords.some((kw) => kw.toLowerCase().includes(q))
      );
    });
  }, [searchQuery, finderFilter]);

  const categorySettingsGroups = useMemo(() => {
    if (!activeCategory) return [];
    const items = ALL_BLIN_SETTINGS.filter((i) => i.category === activeCategory);
    const map = new Map<string, SettingItemSpec[]>();
    for (const item of items) {
      const list = map.get(item.sectionTitle) || [];
      list.push(item);
      map.set(item.sectionTitle, list);
    }
    return Array.from(map.entries());
  }, [activeCategory]);

  function renderSettingRow(item: SettingItemSpec, showCategoryBreadcrumb = false) {
    const val = item.settingKey ? user.settings[item.settingKey] : undefined;

    return (
      <div
        key={item.id}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3.5 px-4 border-b border-white/[0.07] last:border-b-0 hover:bg-white/[0.02] transition-colors"
      >
        <div className="min-w-0 flex-1 pr-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <span>{item.label}</span>
            {showCategoryBreadcrumb && (
              <span className="text-xs font-normal text-slate-400">· {item.finderTag}</span>
            )}
          </div>
          <p className="text-xs text-slate-400 leading-relaxed mt-0.5">{item.description}</p>
        </div>

        <div className="shrink-0 flex items-center">
          {item.controlType === 'toggle' && item.settingKey && (
            <button
              type="button"
              role="switch"
              aria-checked={Boolean(val)}
              onClick={() =>
                updateSettings({ [item.settingKey!]: !val } as Partial<BlinSettings>)
              }
              className={`min-w-[48px] h-7 rounded-full p-1 transition-colors flex items-center cursor-pointer ${
                val ? 'bg-gradient-to-r from-violet-500 to-cyan-400 justify-end' : 'bg-slate-700 justify-start'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-white shadow" />
            </button>
          )}

          {item.controlType === 'select' && item.settingKey && item.options && (
            <select
              value={String(val ?? '')}
              onChange={(e) => {
                const rawVal = e.target.value;
                const numericOption = item.options?.find(
                  (o) => typeof o.value === 'number' && String(o.value) === rawVal
                );
                updateSettings({
                  [item.settingKey!]: numericOption ? numericOption.value : rawVal,
                } as Partial<BlinSettings>);
              }}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#070B22] border border-blue-500/30 text-xs font-medium text-cyan-200 focus:outline-none focus:border-cyan-400"
            >
              {item.options.map((opt) => (
                <option key={String(opt.value)} value={String(opt.value)}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}

          {item.controlType === 'number' && item.settingKey && (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={item.min}
                max={item.max}
                step={item.step || 1}
                value={Number(val ?? 0)}
                onChange={(e) =>
                  updateSettings({
                    [item.settingKey!]: Number(e.target.value),
                  } as Partial<BlinSettings>)
                }
                className="w-24 min-h-[40px] px-3 py-1.5 rounded-xl bg-[#070B22] border border-blue-500/30 text-xs font-mono tabular-nums text-white text-right focus:outline-none focus:border-cyan-400"
              />
            </div>
          )}

          {item.controlType === 'text' && item.settingKey && (
            <input
              type="text"
              defaultValue={String(val ?? '')}
              placeholder="Not set"
              onBlur={(e) =>
                updateSettings(
                  { [item.settingKey!]: e.target.value.trim() } as Partial<BlinSettings>,
                  'Saved'
                )
              }
              className="w-48 min-h-[40px] px-3 py-1.5 rounded-xl bg-[#070B22] border border-blue-500/30 text-xs text-white focus:outline-none focus:border-cyan-400"
            />
          )}

          {item.controlType === 'color' && item.settingKey && (
            <div className="flex items-center gap-2">
              {['#8B5CF6', '#3B82F6', '#06B6D4', '#EC4899', '#F59E0B', '#10B981'].map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() =>
                    updateSettings({
                      [item.settingKey!]: hex,
                      blinTheme: 'custom',
                    } as Partial<BlinSettings>)
                  }
                  className={`w-7 h-7 rounded-full transition-transform ${
                    String(val).toLowerCase() === hex.toLowerCase()
                      ? 'ring-2 ring-white scale-110'
                      : 'opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: hex }}
                  aria-label={`Select accent color ${hex}`}
                />
              ))}
            </div>
          )}

          {item.controlType === 'custom_action' && (
            <button
              type="button"
              onClick={() => triggerCustomAction(item.customActionId)}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-semibold text-cyan-300 flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <span>Open</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Pronunciation voice recording handler
  async function togglePronunciationRecording() {
    if (recordingAudio && recorderInstance) {
      recorderInstance.stop();
      setRecordingAudio(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => {
          updateSettings(
            { pronunciationAudioUrl: String(reader.result || '') },
            'Saved pronunciation voice guide'
          );
        };
        reader.readAsDataURL(blob);
      };
      rec.start();
      setRecorderInstance(rec);
      setRecordingAudio(true);
    } catch {
      notify('Microphone access was not granted');
    }
  }

  const levelInfo = getCreatorLevel(user.pointsBalance);
  const progressPct = Math.min(
    100,
    Math.round(
      ((user.pointsBalance - levelInfo.prevThreshold) /
        Math.max(1, levelInfo.nextThreshold - levelInfo.prevThreshold)) *
        100
    )
  );

  const calcBonusGroups = Math.floor(Math.max(0, calcLikes) / 10);
  const calcTotalPoints =
    Math.max(0, calcLikes) * 10 + Math.max(0, calcFollowers) * 1 + calcBonusGroups * 5;

  const totalStorageBytes =
    storageMetrics.postsAndMediaBytes +
    storageMetrics.chatsBytes +
    storageMetrics.profileAndSettingsBytes;

  return (
    <div className="space-y-6 pb-20">
      {/* Toast Feedback */}
      {toastMsg && (
        <div className="fixed bottom-20 lg:bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl bg-violet-600 text-white text-xs font-semibold shadow-xl flex items-center gap-2">
          <Check className="w-4 h-4" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {activeCategory && (
            <button
              type="button"
              onClick={() => setActiveCategory(null)}
              className="min-w-[44px] min-h-[44px] rounded-xl blin-surface flex items-center justify-center hover:bg-white/5 transition-colors"
              aria-label="Back to all settings"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="font-display font-bold text-2xl tracking-tight">
              {activeCategory
                ? SETTINGS_CATEGORIES.find((c) => c.id === activeCategory)?.title
                : 'Settings'}
            </h1>
            <p className="text-xs text-slate-400">
              {activeCategory
                ? SETTINGS_CATEGORIES.find((c) => c.id === activeCategory)?.subtitle
                : 'Search 140+ privacy, messaging, feed, creator, and BLiN Points controls'}
            </p>
          </div>
        </div>
      </div>

      {/* Persistent Top Settings Search Bar + Interactive Finder Filter */}
      <div className="blin-surface rounded-2xl p-4 space-y-3">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search settings (e.g. Last seen, Blue ticks, QR code, Wallpaper, 2FA, BLiN Points)..."
            className="w-full min-h-[44px] pl-10 pr-4 rounded-xl bg-[#070B22] border border-blue-500/25 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 text-xs text-slate-400 hover:text-white px-2 py-1"
            >
              Clear
            </button>
          )}
        </div>

        {/* Settings Finder Category Filter Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {FINDER_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => {
                setFinderFilter(tag);
                if (tag !== 'All') setActiveCategory(null);
              }}
              className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                finderFilter === tag
                  ? 'blin-cta-gradient text-white'
                  : 'bg-white/[0.04] text-slate-300 hover:bg-white/[0.09]'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Instant Search / Finder Results View */}
      {(searchQuery.trim() !== '' || finderFilter !== 'All') && !activeCategory ? (
        <div className="blin-surface rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">
              Settings Finder · {filteredSettings.length} matching controls
            </span>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setFinderFilter('All');
              }}
              className="text-xs text-cyan-300 hover:underline"
            >
              Show Category Menu
            </button>
          </div>
          {filteredSettings.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">
              No settings matched &ldquo;{searchQuery}&rdquo;. Try searching for privacy, ticks,
              points, theme, or backup.
            </div>
          ) : (
            <div>{filteredSettings.map((item) => renderSettingRow(item, true))}</div>
          )}
        </div>
      ) : !activeCategory ? (
        /* MAIN ORGANIZED SETTINGS MENU */
        <div className="space-y-5">
          {/* Top Profile Summary Card */}
          <div className="blin-surface rounded-2xl p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <UserAvatar name={user.displayName} avatarUrl={user.avatarUrl} size="lg" isOnline />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h2 className="font-display font-bold text-base text-white truncate">
                    {user.displayName}
                  </h2>
                  {user.verified && (
                    <span className="text-xs text-cyan-400 font-semibold">· Verified</span>
                  )}
                </div>
                <p className="text-xs text-slate-400 truncate">@{user.username}</p>
                {user.bio && <p className="text-xs text-slate-300 truncate mt-0.5">{user.bio}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTool('open_qr_modal')}
                className="min-w-[44px] min-h-[44px] rounded-xl bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center text-cyan-300"
                title="Profile QR Code"
              >
                <QrCode className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => setActiveTool('open_profile_editor')}
                className="min-h-[44px] px-4 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-xs font-semibold text-white whitespace-nowrap"
              >
                Edit Profile
              </button>
            </div>
          </div>

          {/* Switch Account Mode Card: Private | Public | Professional (with separate privacy control!) */}
          <div className="blin-surface rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">Switch account mode</span>
              <span className="text-xs text-slate-400">
                Current mode: <strong className="text-white capitalize">{user.settings.accountMode}</strong>{' '}
                · Audience: <strong className="text-cyan-300 capitalize">{user.settings.profileVisibility}</strong>
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(['private', 'public', 'professional'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() =>
                    updateSettings(
                      { accountMode: m },
                      `Switched account mode to ${m.charAt(0).toUpperCase() + m.slice(1)}`
                    )
                  }
                  className={`min-h-[44px] rounded-xl text-xs sm:text-sm font-semibold capitalize transition-all whitespace-nowrap ${
                    user.settings.accountMode === m
                      ? m === 'professional'
                        ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-md'
                        : 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md'
                      : 'bg-[#070B22] border border-white/10 text-slate-300 hover:text-white'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            {user.settings.accountMode === 'professional' && (
              <div className="pt-2 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <span className="text-slate-300">
                  Professional Mode unlocks Creator Studio while keeping your audience privacy
                  separate:
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {(['public', 'private'] as const).map((vis) => (
                    <button
                      key={vis}
                      type="button"
                      onClick={() =>
                        updateSettings(
                          { profileVisibility: vis, requireFollowApproval: vis === 'private' },
                          `Profile visibility set to ${vis}`
                        )
                      }
                      className={`px-3 py-1.5 rounded-lg font-semibold capitalize ${
                        user.settings.profileVisibility === vis
                          ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/40'
                          : 'bg-white/5 text-slate-400'
                      }`}
                    >
                      {vis} Audience
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 15 Organized Category Navigation Rows */}
          <div className="blin-surface rounded-2xl divide-y divide-white/[0.07] overflow-hidden">
            {SETTINGS_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className="w-full min-h-[64px] px-4 py-3.5 flex items-center justify-between gap-3.5 hover:bg-white/[0.03] transition-colors text-left"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-600/25 to-cyan-500/20 border border-white/10 flex items-center justify-center shrink-0">
                    {getCategoryIcon(cat.id)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-display font-semibold text-sm text-white truncate">
                      {cat.title}
                    </p>
                    <p className="text-xs text-slate-400 truncate mt-0.5">{cat.subtitle}</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              </button>
            ))}
          </div>

          {/* Sign Out Button */}
          <button
            type="button"
            onClick={onLogout}
            className="w-full min-h-[48px] rounded-2xl border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-rose-200 font-display font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Log Out</span>
          </button>
        </div>
      ) : (
        /* CATEGORY DETAIL PAGE */
        <div className="space-y-6">
          {/* Special Rich Header Cards for Dedicated Categories */}
          {activeCategory === 'points' && (
            <div className="space-y-4">
              {/* Highlighted BLiN Points Balance Card */}
              <div className="rounded-2xl p-6 bg-gradient-to-br from-violet-900/60 via-[#0F173D] to-cyan-900/40 border border-violet-400/30 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl blin-cta-gradient flex items-center justify-center shadow-lg">
                      <Star className="w-6 h-6 text-white fill-white" />
                    </div>
                    <div>
                      <p className="font-mono tabular-nums font-bold text-3xl text-white">
                        {user.pointsBalance.toLocaleString()}
                      </p>
                      <p className="text-xs text-slate-300">
                        Your BLiN Points · Level {levelInfo.levelNumber} — {levelInfo.title}
                      </p>
                    </div>
                  </div>
                  <div className="text-right text-xs text-slate-300 tabular-nums">
                    <p>{user.qualifyingLikesCount} qualifying likes</p>
                    <p className="text-cyan-300">{user.bonusGroupsAwarded} × 10-like bonuses</p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="h-2.5 w-full rounded-full bg-black/40 overflow-hidden">
                    <div
                      className="h-full blin-cta-gradient transition-all"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-300 font-mono tabular-nums">
                    <span>{levelInfo.title}</span>
                    <span>
                      {user.pointsBalance.toLocaleString()} / {levelInfo.nextThreshold.toLocaleString()} pts
                    </span>
                  </div>
                </div>
              </div>

              {/* Official Scoring Rules + Interactive Example Calculator */}
              <div className="blin-surface rounded-2xl p-5 space-y-4">
                <h3 className="font-display font-bold text-sm text-white">
                  Official BLiN Points Scoring System (Server-Verified)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl bg-[#070B22] border border-white/10">
                    <p className="font-display font-bold text-sm text-violet-300">
                      1 Like = 10 Points
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Earned for every unique non-self like received. Reversed (-10 pts) if unliked.
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#070B22] border border-white/10">
                    <p className="font-display font-bold text-sm text-cyan-300">
                      1 New Follower = 1 Point
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Protected against unfollow/refollow loops — each account can only award once.
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#070B22] border border-white/10">
                    <p className="font-display font-bold text-sm text-amber-300">
                      Every 10 Likes = +5 Bonus
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Stacks on top of like points (e.g. 10 likes = 100 + 5 = 105 pts).
                    </p>
                  </div>
                </div>

                {/* Interactive Points Simulator */}
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
                  <p className="text-xs font-semibold text-slate-300">
                    Points Rule Calculator (Try any numbers — e.g. 100 likes + 50 followers = 1,100 pts)
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                    <label className="space-y-1">
                      <span className="text-[11px] text-slate-400">Qualifying Likes Received</span>
                      <input
                        type="number"
                        min={0}
                        value={calcLikes}
                        onChange={(e) => setCalcLikes(Math.max(0, Number(e.target.value)))}
                        className="w-full min-h-[40px] px-3 rounded-xl bg-[#070B22] border border-blue-500/30 text-sm font-mono tabular-nums text-white"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[11px] text-slate-400">Unique New Followers</span>
                      <input
                        type="number"
                        min={0}
                        value={calcFollowers}
                        onChange={(e) => setCalcFollowers(Math.max(0, Number(e.target.value)))}
                        className="w-full min-h-[40px] px-3 rounded-xl bg-[#070B22] border border-blue-500/30 text-sm font-mono tabular-nums text-white"
                      />
                    </label>
                    <div className="p-2.5 rounded-xl bg-violet-600/20 border border-violet-400/30 text-right font-mono tabular-nums">
                      <span className="block text-[11px] text-slate-300">
                        {calcLikes * 10} + {calcFollowers} + {calcBonusGroups * 5} bonus
                      </span>
                      <span className="font-bold text-lg text-white">
                        = {calcTotalPoints.toLocaleString()} pts
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeCategory === 'storage' && (
            <div className="blin-surface rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-sm text-white">Live Storage Usage</h3>
                <span className="text-xs font-mono tabular-nums text-cyan-300">
                  {formatBytes(totalStorageBytes)} used
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs font-mono tabular-nums">
                <div className="p-3 rounded-xl bg-[#070B22] border border-white/10">
                  <span className="block text-slate-400 font-sans">Posts & Spotlight</span>
                  <strong className="text-white text-sm">
                    {formatBytes(storageMetrics.postsAndMediaBytes)}
                  </strong>
                </div>
                <div className="p-3 rounded-xl bg-[#070B22] border border-white/10">
                  <span className="block text-slate-400 font-sans">Chats & Media</span>
                  <strong className="text-white text-sm">{formatBytes(storageMetrics.chatsBytes)}</strong>
                </div>
                <div className="p-3 rounded-xl bg-[#070B22] border border-white/10">
                  <span className="block text-slate-400 font-sans">Profile & Settings</span>
                  <strong className="text-white text-sm">
                    {formatBytes(storageMetrics.profileAndSettingsBytes)}
                  </strong>
                </div>
              </div>
            </div>
          )}

          {activeCategory === 'communities' && (
            <div className="blin-surface rounded-2xl p-5 space-y-3">
              <h3 className="font-display font-bold text-sm text-white">
                Joined Communities ({communities.filter((c) => c.memberIds.includes(user.id)).length})
              </h3>
              {communities.filter((c) => c.memberIds.includes(user.id)).length === 0 ? (
                <p className="text-xs text-slate-400">
                  You haven&apos;t joined or created any communities yet. Open the Communities tab
                  to create or join real groups.
                </p>
              ) : (
                <div className="divide-y divide-white/10">
                  {communities
                    .filter((c) => c.memberIds.includes(user.id))
                    .map((c) => (
                      <div key={c.id} className="py-2.5 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-semibold text-white">{c.name}</p>
                          <p className="text-slate-400">
                            {c.memberIds.length} member{c.memberIds.length === 1 ? '' : 's'} ·{' '}
                            {c.category}
                          </p>
                        </div>
                        <span className="text-cyan-300">
                          {c.adminIds.includes(user.id) ? 'Admin' : 'Member'}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* Render Grouped Controls for this Category */}
          {categorySettingsGroups.map(([sectionTitle, specs]) => (
            <div key={sectionTitle} className="blin-surface rounded-2xl overflow-hidden">
              <div className="px-4 py-3 bg-white/[0.03] border-b border-white/10">
                <h3 className="font-display font-semibold text-xs text-cyan-300 tracking-wide">
                  {sectionTitle}
                </h3>
              </div>
              <div>{specs.map((spec) => renderSettingRow(spec))}</div>
            </div>
          ))}
        </div>
      )}

      {/* =====================================================================
          INTERACTIVE SETTINGS SUB-TOOLS & MODALS
         ===================================================================== */}
      {activeTool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="blin-surface w-full max-w-xl max-h-[88vh] rounded-3xl flex flex-col overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <h2 className="font-display font-bold text-base text-white">
                {activeTool === 'open_profile_editor' && 'Personal Information & Linked Accounts'}
                {activeTool === 'open_layout_editor' && 'Profile Layout & Navigation Order'}
                {activeTool === 'open_qr_modal' && 'Your BLiN Profile QR Code'}
                {activeTool === 'open_profile_preview' && 'Preview Your Profile Audience View'}
                {activeTool === 'open_multiple_profiles' && 'Multiple Profiles (Personal & Creator)'}
                {activeTool === 'open_pronunciation' && 'Name Pronunciation Guide'}
                {activeTool === 'open_activity_log' && 'Profile & Security Activity Log'}
                {activeTool === 'open_privacy_wizard' && 'BLiN Privacy Checkup Wizard'}
                {activeTool === 'open_hidden_words' && 'Hidden-Word Dictionary'}
                {activeTool === 'open_excluded_topics' && 'Discovery Boundaries (Excluded Topics)'}
                {activeTool === 'open_hidden_posts' && 'Hidden Content Manager'}
                {activeTool === 'open_close_friends' && 'Close Friends Circle'}
                {activeTool === 'open_blocked_restricted' && 'Blocked & Restricted Accounts'}
                {activeTool === 'open_change_password' && 'Change Account Password'}
                {activeTool === 'open_recovery_codes' && 'Two-Factor Backup Recovery Codes'}
                {activeTool === 'open_active_sessions' && 'Active Devices & Sessions'}
                {activeTool === 'open_points_history' && 'BLiN Points Audited Transaction Ledger'}
                {activeTool === 'open_leaderboard' && 'Creator Leaderboard'}
                {activeTool === 'open_creator_analytics' && 'Creator Studio Live Analytics'}
                {(activeTool === 'open_support_ticket' || activeTool === 'open_points_dispute') &&
                  'Support, Appeals & Points Audit'}
                {(activeTool === 'deactivate_account' || activeTool === 'delete_account') &&
                  'Account Deactivation & Permanent Deletion'}
              </h2>
              <button
                type="button"
                onClick={() => setActiveTool(null)}
                className="min-w-[40px] min-h-[40px] rounded-xl hover:bg-white/10 flex items-center justify-center text-slate-300"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-sm">
              {/* 1. PERSONAL INFORMATION EDITOR */}
              {activeTool === 'open_profile_editor' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="p-3 rounded-2xl bg-[#070B22] border border-white/10 flex items-center gap-3 cursor-pointer hover:border-cyan-400/50">
                      <UserAvatar name={user.displayName} avatarUrl={user.avatarUrl} size="md" />
                      <div className="text-xs">
                        <span className="font-semibold text-white flex items-center gap-1">
                          <Camera className="w-3.5 h-3.5 text-violet-400" /> Change Profile Photo
                        </span>
                        <span className="text-slate-400">Upload image</span>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const url = await readFileAsDataUrl(file);
                          await updateProfile({ avatarUrl: url }, 'Updated profile photo');
                        }}
                      />
                    </label>

                    <label className="p-3 rounded-2xl bg-[#070B22] border border-white/10 flex items-center gap-3 cursor-pointer hover:border-cyan-400/50">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-700 to-cyan-600 flex items-center justify-center shrink-0 overflow-hidden">
                        {user.coverUrl ? (
                          <img src={user.coverUrl} alt="Cover" className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="w-5 h-5 text-white" />
                        )}
                      </div>
                      <div className="text-xs">
                        <span className="font-semibold text-white">Change Cover Banner</span>
                        <span className="block text-slate-400">16:9 header image</span>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const url = await readFileAsDataUrl(file);
                          await updateProfile({ coverUrl: url }, 'Updated cover photo');
                        }}
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="space-y-1">
                      <span className="text-xs text-slate-400">Display name</span>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#070B22] border border-blue-500/30 text-white text-sm"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs text-slate-400">Username (@handle)</span>
                      <input
                        type="text"
                        value={editUsername}
                        onChange={(e) => setEditUsername(e.target.value)}
                        className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#070B22] border border-blue-500/30 text-white text-sm"
                      />
                    </label>
                  </div>

                  <label className="block space-y-1">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Bio</span>
                      <span className="tabular-nums">{editBio.length}/150</span>
                    </div>
                    <textarea
                      rows={2}
                      maxLength={150}
                      value={editBio}
                      onChange={(e) => setEditBio(e.target.value)}
                      placeholder="Share your vibe, craft, or interests..."
                      className="w-full p-3 rounded-xl bg-[#070B22] border border-blue-500/30 text-white text-sm"
                    />
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label className="space-y-1">
                      <span className="text-xs text-slate-400">Location</span>
                      <input
                        type="text"
                        value={editLocation}
                        onChange={(e) => setEditLocation(e.target.value)}
                        placeholder="e.g. Kampala, Uganda"
                        className="w-full min-h-[42px] px-3 rounded-xl bg-[#070B22] border border-blue-500/30 text-white text-sm"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs text-slate-400">Website</span>
                      <input
                        type="text"
                        value={editWebsite}
                        onChange={(e) => setEditWebsite(e.target.value)}
                        placeholder="https://..."
                        className="w-full min-h-[42px] px-3 rounded-xl bg-[#070B22] border border-blue-500/30 text-white text-sm"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs text-slate-400">Mood Status Note</span>
                      <input
                        type="text"
                        value={editMood}
                        onChange={(e) => setEditMood(e.target.value)}
                        placeholder="e.g. Editing new video"
                        className="w-full min-h-[42px] px-3 rounded-xl bg-[#070B22] border border-blue-500/30 text-white text-sm"
                      />
                    </label>
                  </div>

                  {/* Linked Accounts */}
                  <div className="pt-2 space-y-2">
                    <p className="text-xs font-semibold text-slate-300">Linked External Accounts</p>
                    {(['google', 'apple', 'instagram'] as const).map((prov) => (
                      <div
                        key={prov}
                        className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#070B22] border border-white/10"
                      >
                        <span className="capitalize text-xs font-medium text-white">{prov}</span>
                        <button
                          type="button"
                          onClick={() =>
                            updateProfile(
                              {
                                linkedAccounts: {
                                  ...user.linkedAccounts,
                                  [prov]: !user.linkedAccounts[prov],
                                },
                              },
                              `Updated ${prov} link status`
                            )
                          }
                          className="text-xs font-semibold text-cyan-300 hover:underline"
                        >
                          {user.linkedAccounts[prov] ? 'Connected (Disconnect)' : 'Not connected (Link)'}
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Verification */}
                  <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#070B22] border border-white/10">
                    <div className="text-xs">
                      <p className="font-semibold text-white">Creator Identity Verification</p>
                      <p className="text-slate-400">Display verified creator badge on your profile</p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        updateProfile(
                          { verified: !user.verified },
                          user.verified ? 'Removed verification badge' : 'Enabled verified badge'
                        )
                      }
                      className="px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-200 text-xs font-semibold"
                    >
                      {user.verified ? 'Verified ✓' : 'Verify Account'}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      await updateProfile(
                        {
                          displayName: editName,
                          username: editUsername,
                          bio: editBio,
                          location: editLocation,
                          website: editWebsite,
                          phone: editPhone,
                          moodStatus: editMood,
                        },
                        'Saved personal profile details'
                      );
                      setActiveTool(null);
                    }}
                    className="w-full min-h-[46px] rounded-xl blin-cta-gradient text-white font-semibold text-sm"
                  >
                    Save Changes
                  </button>
                </div>
              )}

              {/* 2. PROFILE LAYOUT & TAB ORDER EDITOR */}
              {activeTool === 'open_layout_editor' && (
                <div className="space-y-4">
                  <p className="text-xs text-slate-300">
                    Reorder the content tabs on your BLiN Profile so visitors see your best work
                    first:
                  </p>
                  <div className="space-y-2">
                    {user.settings.profileTabOrder.map((tab, idx) => (
                      <div
                        key={tab}
                        className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-[#070B22] border border-white/10"
                      >
                        <span className="capitalize font-medium text-white">
                          {idx + 1}. {tab}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => {
                              const arr = [...user.settings.profileTabOrder];
                              [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
                              updateSettings({ profileTabOrder: arr }, 'Updated profile tab order');
                            }}
                            className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-30"
                          >
                            <ArrowUp className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === user.settings.profileTabOrder.length - 1}
                            onClick={() => {
                              const arr = [...user.settings.profileTabOrder];
                              [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
                              updateSettings({ profileTabOrder: arr }, 'Updated profile tab order');
                            }}
                            className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-30"
                          >
                            <ArrowDown className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. PROFILE QR CODE */}
              {activeTool === 'open_qr_modal' && (
                <div className="flex flex-col items-center text-center space-y-4 py-2">
                  <div className="p-4 bg-white rounded-3xl shadow-xl">
                    {qrDataUrl ? (
                      <img src={qrDataUrl} alt={`QR code for @${user.username}`} className="w-56 h-56" />
                    ) : (
                      <div className="w-56 h-56 flex items-center justify-center text-slate-600">
                        Generating...
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-display font-bold text-lg text-white">{user.displayName}</p>
                    <p className="text-xs text-cyan-300">@{user.username}</p>
                  </div>
                  <div className="flex items-center gap-3 w-full">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(
                          `${window.location.origin}/?profile=${encodeURIComponent(user.username)}`
                        );
                        notify('Copied profile link to clipboard');
                      }}
                      className="flex-1 min-h-[44px] rounded-xl bg-white/10 hover:bg-white/15 font-semibold text-xs flex items-center justify-center gap-2"
                    >
                      <Copy className="w-4 h-4" /> Copy Link
                    </button>
                    {qrDataUrl && (
                      <a
                        href={qrDataUrl}
                        download={`blin-qr-${user.username}.png`}
                        className="flex-1 min-h-[44px] rounded-xl blin-cta-gradient text-white font-semibold text-xs flex items-center justify-center gap-2"
                      >
                        <Download className="w-4 h-4" /> Save QR PNG
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* 4. PROFILE AUDIENCE PREVIEW */}
              {activeTool === 'open_profile_preview' && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-300">
                    Launch your profile in Audience Simulation Mode to verify exactly what each
                    group can see (online status, last seen, points balance, and protected posts):
                  </p>
                  {(['public', 'follower', 'friend'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        setActiveTool(null);
                        onOpenProfilePreview(mode);
                      }}
                      className="w-full p-4 rounded-2xl bg-[#070B22] border border-white/10 hover:border-cyan-400/50 flex items-center justify-between text-left"
                    >
                      <div>
                        <p className="font-semibold text-white capitalize">Preview as {mode}</p>
                        <p className="text-xs text-slate-400">
                          {mode === 'public' && 'Unauthenticated / non-follower visitor view'}
                          {mode === 'follower' && 'Approved follower view'}
                          {mode === 'friend' && 'Mutual contact (follows each other) view'}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-cyan-300" />
                    </button>
                  ))}
                </div>
              )}

              {/* 5. MULTIPLE PROFILES */}
              {activeTool === 'open_multiple_profiles' && (
                <div className="space-y-4">
                  <p className="text-xs text-slate-300">
                    Keep your Personal identity and Creator identity neatly separated under one
                    login:
                  </p>
                  {user.secondaryProfiles.length > 0 && (
                    <div className="space-y-2">
                      {user.secondaryProfiles.map((sp) => (
                        <div
                          key={sp.id}
                          className="p-3.5 rounded-2xl bg-[#070B22] border border-white/10 flex items-center justify-between"
                        >
                          <div>
                            <p className="font-semibold text-white">
                              {sp.displayName} · <span className="text-cyan-300">@{sp.username}</span>
                            </p>
                            <p className="text-xs text-slate-400">{sp.label} Profile</p>
                          </div>
                          <button
                            type="button"
                            onClick={async () => {
                              const res = await apiRequest<{ user: UserAccount }>(
                                '/api/me/subprofiles/switch',
                                {
                                  method: 'POST',
                                  body: JSON.stringify({ subProfileId: sp.id }),
                                }
                              );
                              onUserUpdated(res.user);
                              notify(`Switched active profile to @${res.user.username}`);
                            }}
                            className="px-3.5 py-2 rounded-xl blin-cta-gradient text-xs font-semibold text-white"
                          >
                            Switch To This
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                    <p className="text-xs font-semibold text-white">Add Secondary Profile</p>
                    <div className="grid grid-cols-2 gap-2">
                      {(['Creator', 'Personal'] as const).map((lbl) => (
                        <button
                          key={lbl}
                          type="button"
                          onClick={() => setNewSubLabel(lbl)}
                          className={`py-2 rounded-xl text-xs font-semibold ${
                            newSubLabel === lbl
                              ? 'bg-violet-600 text-white'
                              : 'bg-[#070B22] text-slate-400'
                          }`}
                        >
                          {lbl} Profile
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={newSubName}
                      onChange={(e) => setNewSubName(e.target.value)}
                      placeholder="Profile display name"
                      className="w-full min-h-[40px] px-3 rounded-xl bg-[#070B22] border border-white/10 text-sm text-white"
                    />
                    <input
                      type="text"
                      value={newSubUsername}
                      onChange={(e) => setNewSubUsername(e.target.value)}
                      placeholder="Unique @handle"
                      className="w-full min-h-[40px] px-3 rounded-xl bg-[#070B22] border border-white/10 text-sm text-white"
                    />
                    <input
                      type="text"
                      value={newSubBio}
                      onChange={(e) => setNewSubBio(e.target.value)}
                      placeholder="Short bio"
                      className="w-full min-h-[40px] px-3 rounded-xl bg-[#070B22] border border-white/10 text-sm text-white"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const res = await apiRequest<{ user: UserAccount }>('/api/me/subprofiles', {
                            method: 'POST',
                            body: JSON.stringify({
                              label: newSubLabel,
                              displayName: newSubName,
                              username: newSubUsername,
                              bio: newSubBio,
                            }),
                          });
                          onUserUpdated(res.user);
                          setNewSubName('');
                          setNewSubUsername('');
                          setNewSubBio('');
                          notify('Created secondary profile');
                        } catch (err) {
                          notify(err instanceof Error ? err.message : 'Could not add profile');
                        }
                      }}
                      className="w-full min-h-[42px] rounded-xl blin-cta-gradient text-xs font-semibold text-white"
                    >
                      Create {newSubLabel} Profile
                    </button>
                  </div>
                </div>
              )}

              {/* 6. PRONUNCIATION GUIDE */}
              {activeTool === 'open_pronunciation' && (
                <div className="space-y-4">
                  <label className="block space-y-1">
                    <span className="text-xs text-slate-300">Phonetic Pronunciation</span>
                    <input
                      type="text"
                      value={pronText}
                      onChange={(e) => setPronText(e.target.value)}
                      placeholder="e.g. AH-lex MOR-gan"
                      className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#070B22] border border-blue-500/30 text-white"
                    />
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={togglePronunciationRecording}
                      className={`flex-1 min-h-[44px] rounded-xl font-semibold text-xs flex items-center justify-center gap-2 ${
                        recordingAudio ? 'bg-rose-600 text-white' : 'bg-white/10 text-white'
                      }`}
                    >
                      {recordingAudio ? (
                        <>
                          <Square className="w-4 h-4" /> Stop Recording
                        </>
                      ) : (
                        <>
                          <Mic className="w-4 h-4 text-cyan-300" /> Record Voice Pronunciation
                        </>
                      )}
                    </button>
                    {user.settings.pronunciationAudioUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          const audio = new Audio(user.settings.pronunciationAudioUrl);
                          audio.play();
                        }}
                        className="px-4 min-h-[44px] rounded-xl bg-cyan-500/20 text-cyan-200 text-xs font-semibold flex items-center gap-1.5"
                      >
                        <Volume2 className="w-4 h-4" /> Play
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await updateSettings(
                        { pronunciationText: pronText.trim() },
                        'Saved pronunciation guide'
                      );
                      setActiveTool(null);
                    }}
                    className="w-full min-h-[44px] rounded-xl blin-cta-gradient text-white font-semibold text-xs"
                  >
                    Save Pronunciation
                  </button>
                </div>
              )}

              {/* 7. ACTIVITY LOG */}
              {activeTool === 'open_activity_log' && (
                <div className="space-y-2.5">
                  {user.activityLog.length === 0 ? (
                    <p className="text-xs text-slate-400">No recent account events logged.</p>
                  ) : (
                    user.activityLog.map((entry) => (
                      <div
                        key={entry.id}
                        className="p-3 rounded-xl bg-[#070B22] border border-white/10 flex items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <span className="capitalize text-cyan-300 font-medium">
                            {entry.category}
                          </span>{' '}
                          · <span className="text-slate-200">{entry.action}</span>
                        </div>
                        <span className="text-slate-400 shrink-0 tabular-nums">
                          {formatRelativeTime(entry.createdAt)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* 8. PRIVACY CHECKUP WIZARD */}
              {activeTool === 'open_privacy_wizard' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Step {wizardStep + 1} of 3</span>
                    <span>
                      {user.settings.privacyCheckupCompletedAt
                        ? `Last completed ${formatRelativeTime(user.settings.privacyCheckupCompletedAt)}`
                        : 'Not completed yet'}
                    </span>
                  </div>
                  {wizardStep === 0 && (
                    <div className="space-y-3">
                      <h3 className="font-display font-bold text-white">
                        1. Who can see your presence & blue ticks?
                      </h3>
                      {ALL_BLIN_SETTINGS.filter((s) =>
                        ['priv_online_status', 'priv_last_seen', 'priv_read_receipts', 'priv_typing'].includes(
                          s.id
                        )
                      ).map((s) => renderSettingRow(s))}
                    </div>
                  )}
                  {wizardStep === 1 && (
                    <div className="space-y-3">
                      <h3 className="font-display font-bold text-white">
                        2. Who can message you or add you to groups?
                      </h3>
                      {ALL_BLIN_SETTINGS.filter((s) =>
                        ['priv_visibility', 'priv_who_message', 'priv_who_group'].includes(s.id)
                      ).map((s) => renderSettingRow(s))}
                    </div>
                  )}
                  {wizardStep === 2 && (
                    <div className="space-y-3">
                      <h3 className="font-display font-bold text-white">
                        3. Anti-spam & safety shield
                      </h3>
                      {ALL_BLIN_SETTINGS.filter((s) =>
                        ['priv_anti_spam', 'priv_suspicious_links', 'priv_impersonation'].includes(
                          s.id
                        )
                      ).map((s) => renderSettingRow(s))}
                    </div>
                  )}
                  <div className="flex justify-between pt-2">
                    <button
                      type="button"
                      disabled={wizardStep === 0}
                      onClick={() => setWizardStep((s) => Math.max(0, s - 1))}
                      className="px-4 py-2 rounded-xl bg-white/10 text-xs font-semibold disabled:opacity-40"
                    >
                      Previous
                    </button>
                    {wizardStep < 2 ? (
                      <button
                        type="button"
                        onClick={() => setWizardStep((s) => s + 1)}
                        className="px-5 py-2 rounded-xl blin-cta-gradient text-xs font-semibold text-white"
                      >
                        Next Step
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={async () => {
                          await updateSettings(
                            { privacyCheckupCompletedAt: new Date().toISOString() },
                            'Privacy Checkup completed!'
                          );
                          setWizardStep(0);
                          setActiveTool(null);
                        }}
                        className="px-5 py-2 rounded-xl blin-cta-gradient text-xs font-semibold text-white"
                      >
                        Finish Checkup
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* 9. HIDDEN WORDS DICTIONARY */}
              {activeTool === 'open_hidden_words' && (
                <div className="space-y-4">
                  <p className="text-xs text-slate-300">
                    Posts containing these words or phrases are automatically filtered out of your
                    feed:
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={wordDraft}
                      onChange={(e) => setWordDraft(e.target.value)}
                      placeholder="Add word or phrase..."
                      className="flex-1 min-h-[42px] px-3 rounded-xl bg-[#070B22] border border-blue-500/30 text-white text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const clean = wordDraft.trim();
                        if (!clean) return;
                        updateProfile(
                          { hiddenWords: Array.from(new Set([...user.hiddenWords, clean])) },
                          `Muted "${clean}"`
                        );
                        setWordDraft('');
                      }}
                      className="px-4 rounded-xl blin-cta-gradient text-xs font-semibold text-white"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {user.hiddenWords.length === 0 ? (
                      <span className="text-xs text-slate-400">No hidden words configured.</span>
                    ) : (
                      user.hiddenWords.map((w) => (
                        <button
                          key={w}
                          type="button"
                          onClick={() =>
                            updateProfile({
                              hiddenWords: user.hiddenWords.filter((x) => x !== w),
                            })
                          }
                          className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-rose-500/20 text-xs text-white flex items-center gap-1.5"
                        >
                          <span>{w}</span>
                          <Trash2 className="w-3.5 h-3.5 text-rose-300" />
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* 10. EXCLUDED TOPICS */}
              {activeTool === 'open_excluded_topics' && (
                <div className="space-y-4">
                  <p className="text-xs text-slate-300">
                    Topics added here are excluded from your Feed recommendations:
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={topicDraft}
                      onChange={(e) => setTopicDraft(e.target.value)}
                      placeholder="e.g. Spoilers, Politics..."
                      className="flex-1 min-h-[42px] px-3 rounded-xl bg-[#070B22] border border-blue-500/30 text-white text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const clean = topicDraft.trim();
                        if (!clean) return;
                        updateSettings(
                          {
                            excludedTopics: Array.from(
                              new Set([...user.settings.excludedTopics, clean])
                            ),
                          },
                          `Excluded topic "${clean}"`
                        );
                        setTopicDraft('');
                      }}
                      className="px-4 rounded-xl blin-cta-gradient text-xs font-semibold text-white"
                    >
                      Exclude
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {user.settings.excludedTopics.length === 0 ? (
                      <span className="text-xs text-slate-400">No excluded topics.</span>
                    ) : (
                      user.settings.excludedTopics.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() =>
                            updateSettings({
                              excludedTopics: user.settings.excludedTopics.filter((x) => x !== t),
                            })
                          }
                          className="px-3 py-1.5 rounded-lg bg-white/10 text-xs text-white flex items-center gap-1.5"
                        >
                          <span>{t}</span>
                          <Trash2 className="w-3.5 h-3.5 text-rose-300" />
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* 11. HIDDEN CONTENT MANAGER */}
              {activeTool === 'open_hidden_posts' && (
                <div className="space-y-3">
                  {user.hiddenPostIds.length === 0 ? (
                    <p className="text-xs text-slate-400">You have not hidden any posts.</p>
                  ) : (
                    <>
                      <p className="text-xs text-slate-300">
                        {user.hiddenPostIds.length} hidden post(s):
                      </p>
                      <button
                        type="button"
                        onClick={() => updateProfile({ hiddenPostIds: [] }, 'Restored hidden posts')}
                        className="px-4 py-2 rounded-xl blin-cta-gradient text-xs font-semibold text-white"
                      >
                        Restore All Hidden Posts
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* 12. CLOSE FRIENDS & BLOCKED / RESTRICTED */}
              {activeTool === 'open_close_friends' && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-300">
                    Select real BLiN accounts to include in your Close Friends story circle:
                  </p>
                  {allUsers.filter((u) => u.id !== user.id).length === 0 ? (
                    <p className="text-xs text-slate-400">
                      No other registered users yet. When friends join BLiN, you can add them here.
                    </p>
                  ) : (
                    allUsers
                      .filter((u) => u.id !== user.id)
                      .map((u) => {
                        const inCircle = user.closeFriendIds.includes(u.id);
                        return (
                          <div
                            key={u.id}
                            className="flex items-center justify-between p-3 rounded-xl bg-[#070B22] border border-white/10"
                          >
                            <div className="flex items-center gap-2.5">
                              <UserAvatar name={u.displayName} avatarUrl={u.avatarUrl} size="sm" />
                              <div className="text-xs">
                                <p className="font-semibold text-white">{u.displayName}</p>
                                <p className="text-slate-400">@{u.username}</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                updateProfile({
                                  closeFriendIds: inCircle
                                    ? user.closeFriendIds.filter((id) => id !== u.id)
                                    : [...user.closeFriendIds, u.id],
                                })
                              }
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                                inCircle
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-white/10 text-slate-300'
                              }`}
                            >
                              {inCircle ? 'Close Friend ★' : 'Add'}
                            </button>
                          </div>
                        );
                      })
                  )}
                </div>
              )}

              {activeTool === 'open_blocked_restricted' && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-300">
                    Blocked ({user.blockedUserIds.length}) · Restricted ({user.restrictedUserIds.length})
                  </p>
                  {user.blockedUserIds.length === 0 && user.restrictedUserIds.length === 0 ? (
                    <p className="text-xs text-slate-400">
                      You have no blocked or restricted accounts.
                    </p>
                  ) : (
                    allUsers
                      .filter(
                        (u) =>
                          user.blockedUserIds.includes(u.id) || user.restrictedUserIds.includes(u.id)
                      )
                      .map((u) => (
                        <div
                          key={u.id}
                          className="flex items-center justify-between p-3 rounded-xl bg-[#070B22] border border-white/10"
                        >
                          <span className="text-xs text-white">@{u.username}</span>
                          <div className="flex gap-2">
                            {user.blockedUserIds.includes(u.id) && (
                              <button
                                type="button"
                                onClick={async () => {
                                  const res = await apiRequest<{ user: UserAccount }>(
                                    `/api/users/${u.id}/block`,
                                    { method: 'POST' }
                                  );
                                  onUserUpdated(res.user);
                                }}
                                className="px-3 py-1 rounded-lg bg-rose-500/20 text-rose-200 text-xs"
                              >
                                Unblock
                              </button>
                            )}
                            {user.restrictedUserIds.includes(u.id) && (
                              <button
                                type="button"
                                onClick={async () => {
                                  const res = await apiRequest<{ user: UserAccount }>(
                                    `/api/users/${u.id}/restrict`,
                                    { method: 'POST' }
                                  );
                                  onUserUpdated(res.user);
                                }}
                                className="px-3 py-1 rounded-lg bg-amber-500/20 text-amber-200 text-xs"
                              >
                                Unrestrict
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                  )}
                </div>
              )}

              {/* 13. CHANGE PASSWORD */}
              {activeTool === 'open_change_password' && (
                <div className="space-y-3">
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Current password"
                    className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#070B22] border border-blue-500/30 text-white"
                  />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password (6+ characters)"
                    className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#070B22] border border-blue-500/30 text-white"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await apiRequest('/api/auth/change-password', {
                          method: 'POST',
                          body: JSON.stringify({ currentPassword, newPassword }),
                        });
                        setCurrentPassword('');
                        setNewPassword('');
                        notify('Password updated');
                        setActiveTool(null);
                      } catch (err) {
                        notify(err instanceof Error ? err.message : 'Failed updating password');
                      }
                    }}
                    className="w-full min-h-[44px] rounded-xl blin-cta-gradient text-white font-semibold text-xs"
                  >
                    Update Password
                  </button>
                </div>
              )}

              {/* 14. RECOVERY CODES */}
              {activeTool === 'open_recovery_codes' && (
                <div className="space-y-4">
                  <p className="text-xs text-slate-300">
                    Store these one-time recovery codes in a safe password manager:
                  </p>
                  {user.recoveryCodes.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 font-mono text-xs tabular-nums">
                      {user.recoveryCodes.map((code) => (
                        <div
                          key={code}
                          className="p-2.5 rounded-xl bg-[#070B22] border border-white/10 text-center text-cyan-200"
                        >
                          {code}
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await apiRequest<{ recoveryCodes: string[] }>(
                        '/api/me/recovery-codes',
                        { method: 'POST' }
                      );
                      onUserUpdated({ ...user, recoveryCodes: res.recoveryCodes });
                      notify('Generated 8 new backup codes');
                    }}
                    className="w-full min-h-[44px] rounded-xl blin-cta-gradient text-white font-semibold text-xs"
                  >
                    {user.recoveryCodes.length > 0 ? 'Regenerate Recovery Codes' : 'Generate Recovery Codes'}
                  </button>
                </div>
              )}

              {/* 15. ACTIVE DEVICES */}
              {activeTool === 'open_active_sessions' && (
                <div className="space-y-3">
                  {user.sessions.map((sess) => (
                    <div
                      key={sess.id}
                      className="p-3.5 rounded-2xl bg-[#070B22] border border-white/10 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Smartphone className="w-5 h-5 text-cyan-300 shrink-0" />
                        <div className="text-xs min-w-0">
                          <p className="font-semibold text-white truncate">
                            {sess.platform} {sess.isCurrent && '· Current Session'}
                          </p>
                          <p className="text-slate-400 truncate">{sess.deviceName}</p>
                        </div>
                      </div>
                      <span className="text-[11px] text-slate-400 shrink-0 tabular-nums">
                        {formatRelativeTime(sess.lastActiveAt)}
                      </span>
                    </div>
                  ))}
                  {user.sessions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => triggerCustomAction('logout_other_devices')}
                      className="w-full min-h-[42px] rounded-xl bg-rose-500/20 text-rose-200 font-semibold text-xs"
                    >
                      Log Out of All Other Sessions
                    </button>
                  )}
                </div>
              )}

              {/* 16. POINTS TRANSACTION LEDGER */}
              {activeTool === 'open_points_history' && (
                <div className="space-y-2.5">
                  {user.pointsHistory.length === 0 ? (
                    <p className="text-xs text-slate-400">
                      No BLiN Points transactions yet. Receive likes (+10 pts, +5 bonus per 10
                      likes) or gain followers (+1 pt) from other real accounts to see your audited
                      ledger here.
                    </p>
                  ) : (
                    user.pointsHistory.map((tx) => (
                      <div
                        key={tx.id}
                        className="p-3 rounded-xl bg-[#070B22] border border-white/10 flex items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <p className="text-white font-medium">{tx.description}</p>
                          <p className="text-slate-400 tabular-nums">
                            {formatRelativeTime(tx.createdAt)} · Balance: {tx.balanceAfter} pts
                          </p>
                        </div>
                        <span
                          className={`font-mono font-bold tabular-nums shrink-0 ${
                            tx.pointsDelta > 0
                              ? 'text-emerald-400'
                              : tx.pointsDelta < 0
                              ? 'text-rose-400'
                              : 'text-slate-400'
                          }`}
                        >
                          {tx.pointsDelta > 0 ? `+${tx.pointsDelta}` : tx.pointsDelta} pts
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* 17. LEADERBOARD */}
              {activeTool === 'open_leaderboard' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#070B22]">
                    {(['weekly', 'monthly'] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setLbPeriod(p)}
                        className={`py-2 rounded-lg text-xs font-semibold capitalize ${
                          lbPeriod === p ? 'blin-cta-gradient text-white' : 'text-slate-400'
                        }`}
                      >
                        {p} Rankings
                      </button>
                    ))}
                  </div>
                  {lbEntries.length === 0 ? (
                    <p className="text-xs text-slate-400">
                      No opted-in accounts visible for this leaderboard period yet.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {lbEntries.map((entry, idx) => (
                        <div
                          key={entry.userId}
                          className="p-3 rounded-xl bg-[#070B22] border border-white/10 flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-bold text-sm text-cyan-300 w-6 tabular-nums">
                              #{idx + 1}
                            </span>
                            <UserAvatar
                              name={entry.displayName}
                              avatarUrl={entry.avatarUrl}
                              size="sm"
                            />
                            <div className="text-xs">
                              <p className="font-semibold text-white">{entry.displayName}</p>
                              <p className="text-slate-400">
                                @{entry.username} · {entry.creatorLevel}
                              </p>
                            </div>
                          </div>
                          <div className="text-right font-mono tabular-nums text-xs">
                            <p className="font-bold text-white">+{entry.periodPoints} pts</p>
                            <p className="text-slate-400">{entry.totalPoints} total</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 18. CREATOR ANALYTICS */}
              {activeTool === 'open_creator_analytics' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono tabular-nums">
                    <div className="p-3.5 rounded-xl bg-[#070B22] border border-white/10">
                      <span className="block text-[11px] font-sans text-slate-400">Published</span>
                      <strong className="text-xl text-white">{myPosts.length}</strong>
                    </div>
                    <div className="p-3.5 rounded-xl bg-[#070B22] border border-white/10">
                      <span className="block text-[11px] font-sans text-slate-400">Total Likes</span>
                      <strong className="text-xl text-violet-300">
                        {myPosts.reduce((s, p) => s + p.likeUserIds.length, 0)}
                      </strong>
                    </div>
                    <div className="p-3.5 rounded-xl bg-[#070B22] border border-white/10">
                      <span className="block text-[11px] font-sans text-slate-400">Comments</span>
                      <strong className="text-xl text-cyan-300">
                        {myPosts.reduce((s, p) => s + p.comments.length, 0)}
                      </strong>
                    </div>
                    <div className="p-3.5 rounded-xl bg-[#070B22] border border-white/10">
                      <span className="block text-[11px] font-sans text-slate-400">Followers</span>
                      <strong className="text-xl text-emerald-300">{user.followerIds.length}</strong>
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-[#070B22] border border-white/10 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300">Monthly BLiN Points Goal</span>
                      <span className="font-mono tabular-nums text-cyan-300">
                        {user.pointsBalance} / {user.settings.audienceGrowthMonthlyGoal} pts
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full blin-cta-gradient"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round(
                              (user.pointsBalance /
                                Math.max(1, user.settings.audienceGrowthMonthlyGoal)) *
                                100
                            )
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 19. SUPPORT, MODERATION APPEALS & POINTS DISPUTE */}
              {(activeTool === 'open_support_ticket' || activeTool === 'open_points_dispute') && (
                <div className="space-y-4">
                  <select
                    value={ticketType}
                    onChange={(e) => setTicketType(e.target.value as SupportSubmission['type'])}
                    className="w-full min-h-[42px] px-3 rounded-xl bg-[#070B22] border border-blue-500/30 text-xs text-white"
                  >
                    <option value="bug">Report a Bug</option>
                    <option value="report_user">Report an Account or Content</option>
                    <option value="appeal">Moderation Appeal</option>
                    <option value="points_dispute">BLiN Points Dispute / Audit</option>
                    <option value="copyright">Copyright / IP Complaint</option>
                    <option value="account_recovery">Account Recovery Help</option>
                  </select>
                  <input
                    type="text"
                    value={ticketSubject}
                    onChange={(e) => setTicketSubject(e.target.value)}
                    placeholder="Brief summary..."
                    className="w-full min-h-[42px] px-3 rounded-xl bg-[#070B22] border border-blue-500/30 text-white text-sm"
                  />
                  <textarea
                    rows={3}
                    value={ticketDetails}
                    onChange={(e) => setTicketDetails(e.target.value)}
                    placeholder="Provide relevant details, @usernames, or timestamps..."
                    className="w-full p-3 rounded-xl bg-[#070B22] border border-blue-500/30 text-white text-sm"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const res = await apiRequest<{ submission: SupportSubmission }>(
                          '/api/support',
                          {
                            method: 'POST',
                            body: JSON.stringify({
                              type: ticketType,
                              subject: ticketSubject,
                              details: ticketDetails,
                            }),
                          }
                        );
                        setMyTickets((prev) => [res.submission, ...prev]);
                        setTicketSubject('');
                        setTicketDetails('');
                        notify('Submitted request to BLiN Trust & Support');
                      } catch (err) {
                        notify(err instanceof Error ? err.message : 'Submission failed');
                      }
                    }}
                    className="w-full min-h-[44px] rounded-xl blin-cta-gradient text-white font-semibold text-xs"
                  >
                    Submit Request
                  </button>

                  {myTickets.length > 0 && (
                    <div className="pt-2 space-y-2">
                      <p className="text-xs font-semibold text-slate-300">Your Submitted Cases</p>
                      {myTickets.map((t) => (
                        <div
                          key={t.id}
                          className="p-3 rounded-xl bg-[#070B22] border border-white/10 text-xs flex justify-between"
                        >
                          <div>
                            <p className="font-semibold text-white">{t.subject}</p>
                            <p className="text-slate-400">{t.type}</p>
                          </div>
                          <span className="text-cyan-300">{t.status}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 20. DEACTIVATE / DELETE ACCOUNT */}
              {(activeTool === 'deactivate_account' || activeTool === 'delete_account') && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-400/30 space-y-2">
                    <p className="font-semibold text-amber-200 text-xs flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" /> Deactivate Temporarily
                    </p>
                    <p className="text-xs text-slate-300">
                      Hides your profile and posts until you sign back in again.
                    </p>
                    <button
                      type="button"
                      onClick={async () => {
                        await apiRequest('/api/auth/deactivate', { method: 'POST' });
                        onLogout();
                      }}
                      className="px-4 py-2 rounded-xl bg-amber-500/25 text-amber-100 text-xs font-semibold"
                    >
                      Deactivate My Account
                    </button>
                  </div>

                  <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-2.5">
                    <p className="font-semibold text-rose-200 text-xs">
                      Permanent Account Deletion
                    </p>
                    <p className="text-xs text-slate-300">
                      Type <strong>DELETE</strong> to permanently erase your account, posts, and
                      stories:
                    </p>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder="Type DELETE"
                      className="w-full min-h-[40px] px-3 rounded-xl bg-[#070B22] border border-rose-500/40 text-white text-xs"
                    />
                    <button
                      type="button"
                      disabled={deleteConfirmText !== 'DELETE'}
                      onClick={async () => {
                        await apiRequest('/api/auth/account', { method: 'DELETE' });
                        onLogout();
                      }}
                      className="w-full min-h-[42px] rounded-xl bg-rose-600 text-white font-semibold text-xs disabled:opacity-40"
                    >
                      Permanently Delete Account
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <LegalModal docType={legalDoc} onClose={() => setLegalDoc(null)} />
    </div>
  );
}
