import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  Plus,
  Send,
  Smile,
  Paperclip,
  Mic,
  Square,
  Check,
  CheckCheck,
  Clock,
  Pin,
  Archive,
  SlidersHorizontal,
  CornerUpLeft,
  Edit3,
  Trash2,
  Info,
  Users,
  ChevronLeft,
  Download,
  Lock,
} from 'lucide-react';
import {
  UserAccount,
  PublicUserSummary,
  Conversation,
  ChatMessage,
  PerChatOverride,
} from '../types/blin';
import { UserAvatar } from './BlinLogo';
import { apiRequest, readFileAsDataUrl, formatClockTime, formatRelativeTime } from '../lib/api';

export interface EnrichedConversation extends Conversation {
  participants: PublicUserSummary[];
}

interface MessagingHubProps {
  user: UserAccount;
  conversations: EnrichedConversation[];
  allUsers: PublicUserSummary[];
  typingMap: Record<string, string[]>; // conversationId -> typing displayNames
  onRefreshConversations: () => Promise<void>;
  onSendTyping: (conversationId: string, active: boolean) => void;
  onOpenSettingsCategory: () => void;
  onOpenStreetAI?: () => void;
  initialConversationId?: string | null;
}

const EMOJI_CATEGORIES: Record<string, string[]> = {
  'Smileys & People': [
    '😀', '😂', '🥹', '😍', '🤩', '😎', '🥳', '😇', '🙌', '👏', '🤝', '🙏', '💪', '👀', '🫶', '✨',
  ],
  'Hearts & Vibes': [
    '💜', '💙', '🩵', '❤️', '🔥', '⚡', '🌟', '💫', '🎉', '🎊', '💯', '👑', '💎', '🎵', '🎧', '🚀',
  ],
  'Reactions & Gestures': [
    '👍', '👎', '👌', '✌️', '🤞', '🫡', '🤔', '😮', '😢', '🤯', '😴', '🤗', '🤭', '🤫', '🎯', '🏆',
  ],
};

function getBubbleColorClass(color: string): string {
  switch (color) {
    case 'blue':
      return 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white';
    case 'cyan':
      return 'bg-gradient-to-br from-cyan-600 to-blue-600 text-white';
    case 'emerald':
      return 'bg-gradient-to-br from-emerald-600 to-teal-600 text-white';
    case 'rose':
      return 'bg-gradient-to-br from-rose-600 to-pink-600 text-white';
    default:
      return 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white';
  }
}

function getWallpaperClass(wallpaper: string): string {
  switch (wallpaper) {
    case 'deep_ocean':
      return 'bg-gradient-to-b from-[#041426] via-[#071E36] to-[#04101E]';
    case 'aurora_grid':
      return 'bg-[radial-gradient(circle_at_top_right,#1e1b4b_0%,#06091b_70%)]';
    case 'minimal_dark':
      return 'bg-[#08090F]';
    case 'clean_slate':
      return 'bg-[#10172A]';
    default:
      return 'bg-gradient-to-b from-[#0A102E] via-[#070B20] to-[#090D24]';
  }
}

export function MessagingHub({
  user,
  conversations,
  allUsers,
  typingMap,
  onRefreshConversations,
  onSendTyping,
  onOpenSettingsCategory,
  onOpenStreetAI,
  initialConversationId = null,
}: MessagingHubProps) {
  const [selectedConvId, setSelectedConvId] = useState<string | null>(initialConversationId);
  const [inboxTab, setInboxTab] = useState<'all' | 'unread' | 'groups' | 'requests'>(
    user.settings.unreadOnlyChatView ? 'unread' : 'all'
  );
  const [searchText, setSearchText] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  // Composer state
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editingMsg, setEditingMsg] = useState<ChatMessage | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiSearch, setEmojiSearch] = useState('');
  const [recentEmojis, setRecentEmojis] = useState<string[]>(['😂', '❤️', '🔥', '🙏', '😍', '👍', '💜']);

  // Voice Note recording
  const [recordingVoice, setRecordingVoice] = useState(false);
  const [voiceRecorder, setVoiceRecorder] = useState<MediaRecorder | null>(null);
  const [voiceSpeed, setVoiceSpeed] = useState<'1x' | '1.5x' | '2x'>(
    user.settings.voicePlaybackSpeed
  );

  // New Conversation / Group Modal
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [modalError, setModalError] = useState('');

  // Message Info Drawer (Sent / Delivered / Seen timestamps)
  const [inspectedMessage, setInspectedMessage] = useState<ChatMessage | null>(null);
  // Per-Chat Settings Drawer
  const [showChatCustomize, setShowChatCustomize] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (initialConversationId) {
      setSelectedConvId(initialConversationId);
    }
  }, [initialConversationId]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === selectedConvId) || null,
    [conversations, selectedConvId]
  );

  // Mark messages as seen when viewing active conversation
  useEffect(() => {
    if (!activeConversation) return;
    const hasUnseen = activeConversation.messages.some(
      (m) => m.senderId !== user.id && !m.seenBy.some((r) => r.userId === user.id)
    );
    if (hasUnseen) {
      apiRequest(`/api/conversations/${activeConversation.id}/seen`, { method: 'POST' })
        .then(() => onRefreshConversations())
        .catch(() => {});
    }
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation, user.id, onRefreshConversations]);

  function getConversationDisplay(conv: EnrichedConversation) {
    if (conv.isGroup) {
      return {
        title: conv.groupName || 'Group Chat',
        subtitle: `${conv.participantIds.length} members`,
        avatarUrl: '',
        isOnline: null as boolean | null,
        lastSeenAt: null as string | null,
      };
    }
    const other = conv.participants.find((p) => p.id !== user.id);
    if (!other) {
      return {
        title: user.displayName,
        subtitle: 'Personal Notes',
        avatarUrl: user.avatarUrl,
        isOnline: true,
        lastSeenAt: null,
      };
    }
    let subtitle = `@${other.username}`;
    if (other.isOnline === true) {
      subtitle = 'Online';
    } else if (other.lastSeenAt) {
      subtitle = `Last seen ${formatRelativeTime(other.lastSeenAt)}`;
    }
    return {
      title: other.displayName,
      subtitle,
      avatarUrl: other.avatarUrl,
      isOnline: other.isOnline,
      lastSeenAt: other.lastSeenAt,
    };
  }

  function getUnreadCount(conv: EnrichedConversation): number {
    return conv.messages.filter(
      (m) => m.senderId !== user.id && !m.seenBy.some((r) => r.userId === user.id)
    ).length;
  }

  const filteredConversations = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return conversations
      .filter((c) => {
        const myOverride = c.perUserOverrides[user.id] || {};
        if (showArchived) return Boolean(myOverride.archived);
        if (myOverride.archived) return false;

        const isPendingForMe = c.isRequest && !c.acceptedByIds.includes(user.id);
        if (inboxTab === 'requests') return isPendingForMe;
        if (isPendingForMe) return false;

        if (inboxTab === 'groups' && !c.isGroup) return false;
        if (inboxTab === 'unread' && getUnreadCount(c) === 0) return false;

        if (!q) return true;
        const info = getConversationDisplay(c);
        return (
          info.title.toLowerCase().includes(q) ||
          c.messages.some((m) => m.text.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        const pinA = a.perUserOverrides[user.id]?.pinned ? 1 : 0;
        const pinB = b.perUserOverrides[user.id]?.pinned ? 1 : 0;
        if (user.settings.chatSortOrder === 'pinned_first' && pinA !== pinB) {
          return pinB - pinA;
        }
        if (user.settings.chatSortOrder === 'unread_first') {
          const uA = getUnreadCount(a);
          const uB = getUnreadCount(b);
          if (uA !== uB) return uB - uA;
        }
        if (pinA !== pinB) return pinB - pinA;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }, [conversations, inboxTab, searchText, showArchived, user]);

  async function handleSendMessage(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!activeConversation) return;
    const text = draft.trim();
    if (!text) return;

    setDraft('');
    onSendTyping(activeConversation.id, false);

    if (editingMsg) {
      await apiRequest(
        `/api/conversations/${activeConversation.id}/messages/${editingMsg.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ text }),
        }
      );
      setEditingMsg(null);
      await onRefreshConversations();
      return;
    }

    await apiRequest(`/api/conversations/${activeConversation.id}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        text,
        replyToId: replyTo?.id,
      }),
    });
    setReplyTo(null);
    await onRefreshConversations();
  }

  async function handleAttachFile(file: File) {
    if (!activeConversation) return;
    const dataUrl = await readFileAsDataUrl(file);
    const kind = file.type.startsWith('image/')
      ? 'image'
      : file.type.startsWith('video/')
      ? 'video'
      : 'file';
    await apiRequest(`/api/conversations/${activeConversation.id}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        text: file.name,
        mediaUrl: dataUrl,
        mediaKind: kind,
      }),
    });
    await onRefreshConversations();
  }

  async function toggleVoiceNote() {
    if (!activeConversation) return;
    if (recordingVoice && voiceRecorder) {
      voiceRecorder.stop();
      setRecordingVoice(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const startedAt = Date.now();
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunks.push(ev.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const duration = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = async () => {
          await apiRequest(`/api/conversations/${activeConversation.id}/messages`, {
            method: 'POST',
            body: JSON.stringify({
              text: 'Voice message',
              mediaUrl: String(reader.result || ''),
              mediaKind: 'voice',
              voiceDurationSec: duration,
            }),
          });
          await onRefreshConversations();
        };
        reader.readAsDataURL(blob);
      };
      rec.start();
      setVoiceRecorder(rec);
      setRecordingVoice(true);
    } catch {
      // Microphone unavailable
    }
  }

  async function updatePerChatOverride(patch: Partial<PerChatOverride>) {
    if (!activeConversation) return;
    await apiRequest(`/api/conversations/${activeConversation.id}/override`, {
      method: 'PATCH',
      body: JSON.stringify({ override: patch }),
    });
    await onRefreshConversations();
  }

  function exportActiveConversation() {
    if (!activeConversation) return;
    const blob = new Blob([JSON.stringify(activeConversation, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `blin-chat-${activeConversation.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function renderDeliveryTicks(msg: ChatMessage) {
    if (msg.senderId !== user.id) return null;
    if (msg.status === 'sending') {
      return <Clock className="w-3.5 h-3.5 text-slate-300" aria-label="Sending" />;
    }
    if (msg.status === 'sent') {
      return <Check className="w-3.5 h-3.5 text-slate-300" aria-label="Sent (1 grey tick)" />;
    }
    if (msg.status === 'delivered') {
      return (
        <CheckCheck
          className="w-4 h-4 text-slate-300"
          aria-label="Delivered (2 grey ticks)"
        />
      );
    }
    // Seen: 2 blue/cyan ticks!
    return (
      <CheckCheck
        className="w-4 h-4 text-cyan-300 drop-shadow-[0_0_4px_rgba(34,211,238,0.65)]"
        aria-label="Seen (2 blue ticks)"
      />
    );
  }

  const activeOverride: PerChatOverride = activeConversation
    ? activeConversation.perUserOverrides[user.id] || {}
    : {};
  const activeBubbleColor = activeOverride.customColor || user.settings.defaultBubbleColor;
  const activeWallpaper = activeOverride.wallpaper || user.settings.defaultChatWallpaper;
  const activeTypingUsers = activeConversation ? typingMap[activeConversation.id] || [] : [];

  const msgTextSize =
    user.settings.messageFontScale === 'small'
      ? 'text-xs'
      : user.settings.messageFontScale === 'large'
      ? 'text-base'
      : 'text-sm';

  return (
    <div className="blin-surface rounded-3xl overflow-hidden min-h-[74vh] grid grid-cols-1 lg:grid-cols-12">
      {/* LEFT: CHAT INBOX LIST */}
      <div
        className={`lg:col-span-5 border-r border-white/10 flex flex-col ${
          activeConversation ? 'hidden lg:flex' : 'flex'
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display font-bold text-xl text-white">BLiN Chat</h2>
              <p className="text-xs text-slate-400">Blend in. Talk freely.</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onOpenSettingsCategory}
                className="min-w-[40px] min-h-[40px] rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300"
                title="Messaging Settings"
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setModalError('');
                  setSelectedUserIds([]);
                  setIsCreatingGroup(false);
                  setShowNewChatModal(true);
                }}
                className="min-h-[40px] px-3.5 rounded-xl blin-cta-gradient text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" /> New Chat
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search people and conversations..."
              className="w-full min-h-[40px] pl-9 pr-3 rounded-xl bg-[#070B22] border border-blue-500/25 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400"
            />
          </div>

          {/* Tabs: All, Unread, Groups, Requests + Archived toggle */}
          <div className="flex items-center justify-between gap-1 overflow-x-auto">
            <div className="flex items-center gap-1">
              {(['all', 'unread', 'groups', 'requests'] as const).map((t) => {
                const reqCount =
                  t === 'requests'
                    ? conversations.filter(
                        (c) => c.isRequest && !c.acceptedByIds.includes(user.id)
                      ).length
                    : 0;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setShowArchived(false);
                      setInboxTab(t);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize whitespace-nowrap ${
                      !showArchived && inboxTab === t
                        ? 'blin-cta-gradient text-white'
                        : 'bg-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    {t}
                    {reqCount > 0 ? ` (${reqCount})` : ''}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setShowArchived((v) => !v)}
              className={`p-1.5 rounded-lg text-xs ${
                showArchived ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-white'
              }`}
              title="Archived conversations"
            >
              <Archive className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto divide-y divide-white/[0.06]">
          {/* Snapchat-Style Pinned My AI: Ace (Street-Smart AI) */}
          {onOpenStreetAI && (
            <div
              onClick={onOpenStreetAI}
              className="p-3.5 flex items-center justify-between gap-3 cursor-pointer bg-gradient-to-r from-violet-950/40 via-pink-950/20 to-transparent hover:bg-violet-900/30 transition-colors border-b border-violet-500/20 group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-pink-500 via-violet-600 to-cyan-400 p-0.5 shadow-lg shadow-purple-500/20">
                    <div className="w-full h-full rounded-2xl bg-[#070A1E] flex items-center justify-center font-display font-extrabold text-cyan-300">
                      ⚡
                    </div>
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-[#070A1E]" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-display font-bold text-sm text-white group-hover:text-cyan-300 transition-colors truncate">
                      Ace · Street-Smart AI
                    </span>
                    <span className="px-1.5 py-0.2 rounded-full bg-violet-600/30 border border-violet-500/30 text-violet-300 text-[10px] font-bold">
                      Pinned
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 truncate mt-0.5">
                    Real talk, creator hustle, scam radar & viral caption hooks 🔥
                  </p>
                </div>
              </div>

              <div className="shrink-0 text-right">
                <span className="text-[10px] font-bold text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-500/20">
                  AI Chat
                </span>
              </div>
            </div>
          )}
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <p className="font-display font-semibold text-sm text-white">
                {inboxTab === 'requests'
                  ? 'No pending message requests'
                  : 'No conversations yet'}
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                BLiN contains zero fake accounts or bot chats. Start a real 1-to-1 or Group chat
                with registered BLiN members!
              </p>
              <button
                type="button"
                onClick={() => setShowNewChatModal(true)}
                className="px-4 py-2 rounded-xl blin-cta-gradient text-xs font-semibold text-white"
              >
                Start a Conversation
              </button>
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const info = getConversationDisplay(conv);
              const lastMsg = conv.messages[conv.messages.length - 1];
              const unread = getUnreadCount(conv);
              const isPinned = conv.perUserOverrides[user.id]?.pinned;
              const typingNames = typingMap[conv.id] || [];

              return (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => setSelectedConvId(conv.id)}
                  className={`w-full p-3.5 flex items-center justify-between gap-3 text-left transition-colors ${
                    selectedConvId === conv.id ? 'bg-violet-600/15' : 'hover:bg-white/[0.03]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <UserAvatar
                      name={info.title}
                      avatarUrl={info.avatarUrl}
                      size="md"
                      isOnline={info.isOnline}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-display font-semibold text-sm text-white truncate">
                          {info.title}
                        </span>
                        {isPinned && <Pin className="w-3 h-3 text-cyan-300 shrink-0" />}
                        {conv.perUserOverrides[user.id]?.locked && (
                          <Lock className="w-3 h-3 text-violet-300 shrink-0" />
                        )}
                      </div>
                      <p className="text-xs truncate mt-0.5">
                        {typingNames.length > 0 ? (
                          <span className="text-cyan-300 font-medium">
                            {typingNames[0]} is typing…
                          </span>
                        ) : lastMsg ? (
                          <span className="text-slate-400 flex items-center gap-1">
                            {renderDeliveryTicks(lastMsg)}
                            <span className="truncate">{lastMsg.text}</span>
                          </span>
                        ) : (
                          <span className="text-slate-500">{info.subtitle}</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0 space-y-1">
                    <span className="block text-[11px] text-slate-400 tabular-nums">
                      {lastMsg ? formatClockTime(lastMsg.sentAt) : ''}
                    </span>
                    {unread > 0 && (
                      <span className="inline-block px-2 py-0.5 rounded-full bg-violet-500 text-[11px] font-mono font-bold text-white tabular-nums">
                        {unread}
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT: ACTIVE CONVERSATION THREAD */}
      <div
        className={`lg:col-span-7 flex flex-col ${
          activeConversation ? 'flex' : 'hidden lg:flex'
        } ${getWallpaperClass(activeWallpaper)}`}
      >
        {!activeConversation ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
              <Users className="w-6 h-6 text-cyan-300" />
            </div>
            <h3 className="font-display font-bold text-lg text-white">Select a Conversation</h3>
            <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
              Send messages, voice notes, photos, reactions, and threads with real-time grey/blue
              delivery receipts and configurable presence privacy.
            </p>
          </div>
        ) : (
          <>
            {/* Conversation Header */}
            {(() => {
              const info = getConversationDisplay(activeConversation);
              return (
                <div className="px-4 py-3 bg-[#090E26]/90 backdrop-blur-md border-b border-white/10 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => setSelectedConvId(null)}
                      className="lg:hidden min-w-[40px] min-h-[40px] rounded-xl bg-white/5 flex items-center justify-center"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <UserAvatar
                      name={info.title}
                      avatarUrl={info.avatarUrl}
                      size="sm"
                      isOnline={info.isOnline}
                    />
                    <div className="min-w-0">
                      <h3 className="font-display font-bold text-sm text-white truncate">
                        {info.title}
                      </h3>
                      <p className="text-[11px] text-cyan-300/90 truncate">
                        {activeTypingUsers.length > 0
                          ? `${activeTypingUsers.join(', ')} typing…`
                          : info.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => updatePerChatOverride({ pinned: !activeOverride.pinned })}
                      className={`min-w-[38px] min-h-[38px] rounded-xl flex items-center justify-center ${
                        activeOverride.pinned
                          ? 'bg-cyan-500/20 text-cyan-300'
                          : 'bg-white/5 text-slate-300 hover:bg-white/10'
                      }`}
                      title="Pin chat"
                    >
                      <Pin className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => updatePerChatOverride({ archived: !activeOverride.archived })}
                      className="min-w-[38px] min-h-[38px] rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300"
                      title="Archive chat"
                    >
                      <Archive className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowChatCustomize((v) => !v)}
                      className="min-w-[38px] min-h-[38px] rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300"
                      title="Per-chat theme, receipts & timer"
                    >
                      <SlidersHorizontal className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Optional Per-Chat Customization Strip */}
            {showChatCustomize && (
              <div className="px-4 py-3 bg-[#0D1438] border-b border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-300">Bubble:</span>
                  {(['violet', 'blue', 'cyan', 'emerald', 'rose'] as const).map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => updatePerChatOverride({ customColor: col })}
                      className={`px-2.5 py-1 rounded-lg capitalize ${
                        activeBubbleColor === col
                          ? 'bg-white text-slate-900 font-semibold'
                          : 'bg-white/10 text-slate-300'
                      }`}
                    >
                      {col}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={activeOverride.readReceiptsOverride || 'default'}
                    onChange={(e) =>
                      updatePerChatOverride({
                        readReceiptsOverride: e.target.value as 'default' | 'on' | 'off',
                      })
                    }
                    className="px-2.5 py-1.5 rounded-lg bg-[#070B22] border border-white/10 text-white"
                  >
                    <option value="default">Blue Ticks: Global Default</option>
                    <option value="on">Blue Ticks: Always On</option>
                    <option value="off">Blue Ticks: Off in this Chat</option>
                  </select>
                  <button
                    type="button"
                    onClick={exportActiveConversation}
                    className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-cyan-200 flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" /> Export
                  </button>
                </div>
              </div>
            )}

            {/* Message Request Banner if pending */}
            {activeConversation.isRequest &&
              !activeConversation.acceptedByIds.includes(user.id) && (
                <div className="p-3.5 bg-violet-950/70 border-b border-violet-500/30 flex items-center justify-between gap-3 text-xs">
                  <span className="text-slate-200">
                    Message Request: Sender won&apos;t see read receipts until you accept.
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      await apiRequest(`/api/conversations/${activeConversation.id}/accept`, {
                        method: 'POST',
                      });
                      await onRefreshConversations();
                    }}
                    className="px-4 py-1.5 rounded-lg blin-cta-gradient text-white font-semibold shrink-0"
                  >
                    Accept Request
                  </button>
                </div>
              )}

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {activeConversation.messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                  Say hello to start your conversation!
                </div>
              ) : (
                activeConversation.messages.map((msg) => {
                  const isMine = msg.senderId === user.id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                    >
                      {activeConversation.isGroup && !isMine && (
                        <span className="text-[11px] text-cyan-300 mb-0.5 px-1">
                          {msg.senderName}
                        </span>
                      )}

                      <div
                        className={`max-w-[82%] sm:max-w-[72%] rounded-2xl px-3.5 py-2.5 shadow-md space-y-1.5 ${
                          isMine
                            ? getBubbleColorClass(activeBubbleColor)
                            : 'bg-[#151D44] border border-white/10 text-slate-100'
                        }`}
                      >
                        {user.settings.replyPreviews && msg.replyPreviewText && (
                          <div className="px-2.5 py-1.5 rounded-lg bg-black/25 text-[11px] text-slate-200 truncate">
                            ↩ {msg.replyPreviewText}
                          </div>
                        )}

                        {msg.mediaUrl && msg.mediaKind === 'image' && (
                          <img
                            src={msg.mediaUrl}
                            alt="Chat attachment"
                            className="rounded-xl max-h-60 object-cover w-full"
                          />
                        )}

                        {msg.mediaUrl && msg.mediaKind === 'voice' && (
                          <div className="flex items-center gap-2 py-1">
                            <audio
                              controls
                              src={msg.mediaUrl}
                              className="h-8 max-w-[190px]"
                              onPlay={(e) => {
                                e.currentTarget.playbackRate =
                                  voiceSpeed === '2x' ? 2 : voiceSpeed === '1.5x' ? 1.5 : 1;
                              }}
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setVoiceSpeed((s) =>
                                  s === '1x' ? '1.5x' : s === '1.5x' ? '2x' : '1x'
                                )
                              }
                              className="px-2 py-1 rounded bg-black/30 text-[11px] font-mono tabular-nums"
                            >
                              {voiceSpeed}
                            </button>
                          </div>
                        )}

                        <p
                          className={`${msgTextSize} leading-relaxed break-words ${
                            msg.deletedForEveryone ? 'italic opacity-70' : ''
                          }`}
                        >
                          {msg.text}
                        </p>

                        {/* Reactions */}
                        {msg.reactions.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {msg.reactions.map((r, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 rounded-md bg-black/30 text-xs"
                              >
                                {r.emoji}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Timestamp + Edited + Delivery/Seen Ticks + Actions */}
                        <div className="flex items-center justify-end gap-2 pt-0.5 text-[10px] opacity-85">
                          {msg.pinned && <span>📌</span>}
                          {msg.editedAt && !msg.deletedForEveryone && <span>Edited</span>}
                          <span className="tabular-nums">{formatClockTime(msg.sentAt)}</span>
                          {renderDeliveryTicks(msg)}
                          <button
                            type="button"
                            onClick={() => setInspectedMessage(msg)}
                            className="hover:opacity-100 opacity-75"
                            title="Inspect Sent / Delivered / Seen times"
                          >
                            <Info className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Quick Action Strip underneath message */}
                      {!msg.deletedForEveryone && (
                        <div className="flex items-center gap-2 mt-1 px-1 text-[11px] text-slate-400">
                          <button
                            type="button"
                            onClick={async () => {
                              await apiRequest(
                                `/api/conversations/${activeConversation.id}/messages/${msg.id}`,
                                {
                                  method: 'PATCH',
                                  body: JSON.stringify({
                                    emojiReaction: user.settings.defaultQuickReaction,
                                  }),
                                }
                              );
                              await onRefreshConversations();
                            }}
                            className="hover:text-white"
                          >
                            {user.settings.defaultQuickReaction}
                          </button>
                          <button
                            type="button"
                            onClick={() => setReplyTo(msg)}
                            className="hover:text-white flex items-center gap-0.5"
                          >
                            <CornerUpLeft className="w-3 h-3" /> Reply
                          </button>
                          {isMine && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingMsg(msg);
                                  setDraft(msg.text);
                                }}
                                className="hover:text-white flex items-center gap-0.5"
                              >
                                <Edit3 className="w-3 h-3" /> Edit
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  await apiRequest(
                                    `/api/conversations/${activeConversation.id}/messages/${msg.id}`,
                                    {
                                      method: 'PATCH',
                                      body: JSON.stringify({ deleteForEveryone: true }),
                                    }
                                  );
                                  await onRefreshConversations();
                                }}
                                className="hover:text-rose-300 flex items-center gap-0.5"
                              >
                                <Trash2 className="w-3 h-3" /> Delete
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply / Edit Banner */}
            {(replyTo || editingMsg) && (
              <div className="px-4 py-2 bg-[#11183C] border-t border-white/10 flex items-center justify-between text-xs">
                <span className="text-cyan-200 truncate">
                  {editingMsg
                    ? `Editing message: "${editingMsg.text}"`
                    : `Replying to ${replyTo?.senderName}: "${replyTo?.text}"`}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setReplyTo(null);
                    setEditingMsg(null);
                  }}
                  className="text-slate-400 hover:text-white pl-3"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Real Emoji Picker Drawer (matching panel #13 in uploaded reference) */}
            {showEmojiPicker && (
              <div className="p-3 bg-[#0B102B] border-t border-white/10 space-y-2.5 max-h-56 overflow-y-auto">
                <input
                  type="text"
                  value={emojiSearch}
                  onChange={(e) => setEmojiSearch(e.target.value)}
                  placeholder="Search emoji..."
                  className="w-full min-h-[36px] px-3 rounded-xl bg-[#070A1E] border border-white/10 text-xs text-white"
                />
                {!emojiSearch && (
                  <div>
                    <p className="text-[11px] text-slate-400 mb-1">Recently used</p>
                    <div className="flex flex-wrap gap-1.5">
                      {recentEmojis.map((em) => (
                        <button
                          key={em}
                          type="button"
                          onClick={() => setDraft((d) => d + em)}
                          className="w-9 h-9 rounded-lg hover:bg-white/10 text-lg flex items-center justify-center"
                        >
                          {em}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {Object.entries(EMOJI_CATEGORIES).map(([catName, list]) => (
                  <div key={catName}>
                    <p className="text-[11px] text-slate-400 mb-1">{catName}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {list.map((em) => (
                        <button
                          key={em}
                          type="button"
                          onClick={() => {
                            setDraft((d) => d + em);
                            setRecentEmojis((prev) =>
                              Array.from(new Set([em, ...prev])).slice(0, 10)
                            );
                          }}
                          className="w-9 h-9 rounded-lg hover:bg-white/10 text-lg flex items-center justify-center"
                        >
                          {em}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Composer Input Bar */}
            <form
              onSubmit={handleSendMessage}
              className="p-3 bg-[#090E26] border-t border-white/10 flex items-center gap-2"
            >
              <label className="min-w-[42px] min-h-[42px] rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center cursor-pointer text-slate-300">
                <Paperclip className="w-4 h-4" />
                <input
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleAttachFile(f);
                  }}
                />
              </label>

              <button
                type="button"
                onClick={() => setShowEmojiPicker((v) => !v)}
                className="min-w-[42px] min-h-[42px] rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300"
                title="Open emoji picker"
              >
                <Smile className="w-4 h-4" />
              </button>

              <input
                type="text"
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  onSendTyping(activeConversation.id, true);
                  if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
                  typingTimeoutRef.current = window.setTimeout(() => {
                    onSendTyping(activeConversation.id, false);
                  }, 1800);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && user.settings.enterToSend) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Type a message..."
                className="flex-1 min-h-[42px] px-4 rounded-full bg-[#070A1E] border border-blue-500/25 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400"
              />

              <button
                type="button"
                onClick={toggleVoiceNote}
                className={`min-w-[42px] min-h-[42px] rounded-full flex items-center justify-center ${
                  recordingVoice
                    ? 'bg-rose-600 text-white'
                    : 'bg-white/5 hover:bg-white/10 text-slate-300'
                }`}
                title="Record voice message"
              >
                {recordingVoice ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              <button
                type="submit"
                className="min-w-[44px] min-h-[44px] rounded-full blin-cta-gradient text-white flex items-center justify-center shadow-md"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </>
        )}
      </div>

      {/* MESSAGE DELIVERY / SEEN DETAIL MODAL */}
      {inspectedMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="blin-surface w-full max-w-sm rounded-3xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-base text-white">Message Receipt Info</h3>
              <button
                type="button"
                onClick={() => setInspectedMessage(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="p-3 rounded-xl bg-[#070B22] border border-white/10 text-xs text-slate-200">
              {inspectedMessage.text}
            </div>
            <div className="space-y-2 text-xs font-mono tabular-nums">
              <div className="flex justify-between py-1.5 border-b border-white/10">
                <span className="font-sans text-slate-400 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" /> Sent (1 grey tick)
                </span>
                <span className="text-white">{formatClockTime(inspectedMessage.sentAt)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/10">
                <span className="font-sans text-slate-400 flex items-center gap-1.5">
                  <CheckCheck className="w-3.5 h-3.5" /> Delivered (2 grey ticks)
                </span>
                <span className="text-white">
                  {inspectedMessage.deliveredAt
                    ? formatClockTime(inspectedMessage.deliveredAt)
                    : 'Waiting for recipient device'}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="font-sans text-cyan-300 flex items-center gap-1.5">
                  <CheckCheck className="w-3.5 h-3.5 text-cyan-300" /> Seen (2 blue ticks)
                </span>
                <span className="text-cyan-200">
                  {inspectedMessage.seenAt
                    ? formatClockTime(inspectedMessage.seenAt)
                    : 'Not marked read / Hidden by privacy'}
                </span>
              </div>
            </div>
            {inspectedMessage.seenBy.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <p className="text-[11px] font-semibold text-slate-300">Seen by members:</p>
                {inspectedMessage.seenBy.map((r) => (
                  <div
                    key={r.userId}
                    className="flex justify-between text-xs text-slate-300 tabular-nums"
                  >
                    <span>@{r.username}</span>
                    <span>{formatClockTime(r.seenAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* NEW 1-TO-1 OR GROUP CONVERSATION MODAL */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="blin-surface w-full max-w-md rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-lg text-white">New Conversation</h3>
              <button
                type="button"
                onClick={() => setShowNewChatModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#070B22]">
              <button
                type="button"
                onClick={() => {
                  setIsCreatingGroup(false);
                  setSelectedUserIds((prev) => prev.slice(0, 1));
                }}
                className={`py-2 rounded-lg text-xs font-semibold ${
                  !isCreatingGroup ? 'blin-cta-gradient text-white' : 'text-slate-400'
                }`}
              >
                Direct Chat
              </button>
              <button
                type="button"
                onClick={() => setIsCreatingGroup(true)}
                className={`py-2 rounded-lg text-xs font-semibold ${
                  isCreatingGroup ? 'blin-cta-gradient text-white' : 'text-slate-400'
                }`}
              >
                Group Chat
              </button>
            </div>

            {isCreatingGroup && (
              <div className="space-y-2">
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Group name (e.g. Creators Circle)"
                  className="w-full min-h-[40px] px-3.5 rounded-xl bg-[#070B22] border border-white/10 text-sm text-white"
                />
                <input
                  type="text"
                  value={groupDesc}
                  onChange={(e) => setGroupDesc(e.target.value)}
                  placeholder="Optional group description"
                  className="w-full min-h-[40px] px-3.5 rounded-xl bg-[#070B22] border border-white/10 text-sm text-white"
                />
              </div>
            )}

            {modalError && <p className="text-xs text-rose-400">{modalError}</p>}

            <div className="max-h-56 overflow-y-auto space-y-2">
              {allUsers.filter((u) => u.id !== user.id).length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">
                  No other registered users yet. Create a second real account in another browser
                  window to test live two-way blue ticks and typing indicators!
                </p>
              ) : (
                allUsers
                  .filter((u) => u.id !== user.id)
                  .map((u) => {
                    const selected = selectedUserIds.includes(u.id);
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          if (!isCreatingGroup) {
                            setSelectedUserIds([u.id]);
                          } else {
                            setSelectedUserIds((prev) =>
                              prev.includes(u.id)
                                ? prev.filter((id) => id !== u.id)
                                : [...prev, u.id]
                            );
                          }
                        }}
                        className={`w-full p-3 rounded-xl border flex items-center justify-between text-left ${
                          selected
                            ? 'bg-violet-600/20 border-cyan-400'
                            : 'bg-[#070B22] border-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <UserAvatar
                            name={u.displayName}
                            avatarUrl={u.avatarUrl}
                            size="sm"
                            isOnline={u.isOnline}
                          />
                          <div className="text-xs">
                            <p className="font-semibold text-white">{u.displayName}</p>
                            <p className="text-slate-400">@{u.username}</p>
                          </div>
                        </div>
                        {selected && <Check className="w-4 h-4 text-cyan-300" />}
                      </button>
                    );
                  })
              )}
            </div>

            <button
              type="button"
              disabled={selectedUserIds.length === 0}
              onClick={async () => {
                try {
                  const res = await apiRequest<{ conversation: Conversation }>(
                    '/api/conversations',
                    {
                      method: 'POST',
                      body: JSON.stringify({
                        participantIds: selectedUserIds,
                        isGroup: isCreatingGroup,
                        groupName,
                        groupDescription: groupDesc,
                      }),
                    }
                  );
                  await onRefreshConversations();
                  setSelectedConvId(res.conversation.id);
                  setShowNewChatModal(false);
                } catch (err) {
                  setModalError(err instanceof Error ? err.message : 'Could not create chat');
                }
              }}
              className="w-full min-h-[44px] rounded-xl blin-cta-gradient text-white font-semibold text-xs disabled:opacity-40"
            >
              {isCreatingGroup ? 'Create Group Chat' : 'Open Chat'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
