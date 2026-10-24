import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Hand,
  MessageSquare,
  Users,
  LogOut,
  Radio,
  Sparkles,
  Send,
  Volume2,
  VolumeX,
  X,
  Plus,
  Shield,
  Smile,
  Crown,
  ChevronDown,
  UserCheck,
  UserMinus,
  AlertCircle,
  Headphones,
  CheckCircle2,
} from 'lucide-react';
import {
  UserAccount,
  VoiceRoomItem,
  VoiceParticipant,
  VoiceRoomChat,
  PublicUserSummary,
} from '../types/blin';
import { UserAvatar } from './BlinLogo';
import { apiRequest, formatClockTime } from '../lib/api';

interface VoiceRoomHubProps {
  user: UserAccount;
  rooms: VoiceRoomItem[];
  allUsers: PublicUserSummary[];
  onRefreshAll: () => Promise<void>;
  onSelectUsername: (username: string) => void;
  sendWebSocketEvent?: (event: string, payload: any) => void;
}

export function VoiceRoomHub({
  user,
  rooms,
  allUsers,
  onRefreshAll,
  onSelectUsername,
  sendWebSocketEvent,
}: VoiceRoomHubProps) {
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTopic, setNewTopic] = useState('Creators & Tech');
  const [newDescription, setNewDescription] = useState('');

  // Inside Active Room state
  const [isMuted, setIsMuted] = useState(true);
  const [hasRaisedHand, setHasRaisedHand] = useState(false);
  const [showInRoomChat, setShowInRoomChat] = useState(true);
  const [chatInput, setChatInput] = useState('');
  const [floatingEmojis, setFloatingEmojis] = useState<
    { id: string; emoji: string; x: number; y: number }[]
  >([]);

  // Host participant management modal
  const [selectedParticipant, setSelectedParticipant] = useState<VoiceParticipant | null>(null);
  const [showEndRoomConfirm, setShowEndRoomConfirm] = useState(false);
  const [micPermissionError, setMicPermissionError] = useState<string | null>(null);
  const [presenceNotice, setPresenceNotice] = useState<string | null>(null);

  // Audio stream and analysis refs
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isSpeakingStateRef = useRef(false);

  // Real-time soundwave visualizer levels (14 frequency bands)
  const [soundwaveLevels, setSoundwaveLevels] = useState<number[]>([
    20, 35, 60, 45, 80, 50, 70, 75, 40, 60, 85, 55, 30, 40,
  ]);

  const activeRoom = rooms.find((r) => r.id === activeRoomId) || null;
  const isHost = activeRoom ? activeRoom.hostId === user.id : false;
  const currentUserParticipant = activeRoom?.participants.find((p) => p.userId === user.id);
  const isSpeaker = currentUserParticipant?.role === 'host' || currentUserParticipant?.role === 'speaker';

  // ---------------------------------------------------------------------------
  // WEB AUDIO API: REAL-TIME MICROPHONE PROCESSING
  // ---------------------------------------------------------------------------
  const stopAudioCapture = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    isSpeakingStateRef.current = false;
  }, []);

  const startAudioCapture = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMicPermissionError('Web Audio is not supported in this browser environment.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      audioStreamRef.current = stream;
      setMicPermissionError(null);

      // Create AudioContext
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;

        // Map frequency bands to soundwave bars
        const bars = [];
        const step = Math.max(1, Math.floor(bufferLength / 14));
        for (let i = 0; i < 14; i++) {
          const val = dataArray[i * step] || 0;
          bars.push(Math.max(15, Math.min(100, Math.round((val / 255) * 100))));
        }
        setSoundwaveLevels(bars);

        // Detect speaking threshold
        const speakingNow = average > 18 && !isMuted;
        if (speakingNow !== isSpeakingStateRef.current) {
          isSpeakingStateRef.current = speakingNow;
          if (activeRoomId && sendWebSocketEvent) {
            sendWebSocketEvent('voiceroom:speaking', {
              roomId: activeRoomId,
              isSpeaking: speakingNow,
              volume: Math.round(average),
            });
          }
        }

        animationFrameRef.current = requestAnimationFrame(checkVolume);
      };

      checkVolume();
    } catch (err: any) {
      console.warn('Microphone access note:', err.message);
      setMicPermissionError(
        'Microphone is muted or permission was not granted. You can still listen and participate in room chat!'
      );
    }
  }, [activeRoomId, isMuted, sendWebSocketEvent]);

  // Sync mic track enabled state with isMuted
  useEffect(() => {
    if (audioStreamRef.current) {
      audioStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !isMuted;
      });
    }
  }, [isMuted]);

  // Initialize/cleanup audio capture when joining/leaving room
  useEffect(() => {
    if (activeRoomId && isSpeaker) {
      startAudioCapture();
    } else {
      stopAudioCapture();
    }
    return () => {
      stopAudioCapture();
    };
  }, [activeRoomId, isSpeaker, startAudioCapture, stopAudioCapture]);

  // Clean up floating emojis
  useEffect(() => {
    if (floatingEmojis.length === 0) return;
    const timer = setTimeout(() => {
      setFloatingEmojis((prev) => prev.slice(1));
    }, 2500);
    return () => clearTimeout(timer);
  }, [floatingEmojis]);

  // Clean up presence notice
  useEffect(() => {
    if (!presenceNotice) return;
    const timer = setTimeout(() => {
      setPresenceNotice(null);
    }, 3500);
    return () => clearTimeout(timer);
  }, [presenceNotice]);

  // ---------------------------------------------------------------------------
  // WEBSOCKET PRESENCE & REAL-TIME EVENT LISTENER
  // ---------------------------------------------------------------------------
  useEffect(() => {
    function handleWebSocketEvent(e: Event) {
      const customEvent = e as CustomEvent;
      const data = customEvent.detail;
      if (!data) return;

      if (data.type === 'voiceroom:speaking' && data.roomId === activeRoomId) {
        // Speaker speaking indicator
        if (data.volume !== undefined && data.isSpeaking) {
          setSoundwaveLevels((prev) =>
            prev.map(() => Math.floor(Math.random() * 60) + Math.min(40, data.volume || 30))
          );
        }
      } else if (data.type === 'voiceroom:reaction' && data.roomId === activeRoomId) {
        if (data.reaction) {
          setFloatingEmojis((prev) => [
            ...prev,
            {
              id: data.reaction.id,
              emoji: data.reaction.emoji,
              x: Math.floor(Math.random() * 60) + 20,
              y: 80,
            },
          ]);
        }
      } else if (data.type === 'voiceroom:joined' && data.roomId === activeRoomId) {
        const p = data.participant;
        if (p && p.userId !== user.id) {
          setPresenceNotice(`@${p.username} joined the voice room`);
        }
      } else if (data.type === 'voiceroom:left' && data.roomId === activeRoomId) {
        if (data.userId && data.userId !== user.id) {
          const departing = allUsers.find((u) => u.id === data.userId);
          const name = departing ? departing.displayName : 'A participant';
          setPresenceNotice(`${name} left the room`);
        }
      } else if (data.type === 'voiceroom:ended' && data.roomId === activeRoomId) {
        setActiveRoomId(null);
        stopAudioCapture();
        alert('The host has ended this live voice room.');
      }
    }

    window.addEventListener('blin:ws', handleWebSocketEvent);
    return () => {
      window.removeEventListener('blin:ws', handleWebSocketEvent);
    };
  }, [activeRoomId, allUsers, stopAudioCapture, user.id]);

  // ---------------------------------------------------------------------------
  // ROOM ACTIONS (CREATE, JOIN, LEAVE, MUTE, RAISE HAND, HOST MANAGEMENT)
  // ---------------------------------------------------------------------------
  async function handleCreateRoom(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      const room = await apiRequest<VoiceRoomItem>('/api/voicerooms', {
        method: 'POST',
        body: JSON.stringify({
          title: newTitle.trim(),
          topic: newTopic,
          description: newDescription.trim(),
        }),
      });
      setShowCreateModal(false);
      setNewTitle('');
      setNewDescription('');
      await onRefreshAll();
      setActiveRoomId(room.id);
      setIsMuted(false); // Host starts unmuted on stage
    } catch (err) {
      console.error('Failed to create voice room', err);
    }
  }

  async function handleJoinRoom(roomId: string) {
    try {
      await apiRequest(`/api/voicerooms/${roomId}/join`, { method: 'POST' });
      setActiveRoomId(roomId);
      setIsMuted(true);
      setHasRaisedHand(false);
      await onRefreshAll();
    } catch (err) {
      console.error('Failed to join room', err);
    }
  }

  async function handleLeaveRoom() {
    if (!activeRoomId) return;
    try {
      stopAudioCapture();
      await apiRequest(`/api/voicerooms/${activeRoomId}/leave`, { method: 'POST' });
      setActiveRoomId(null);
      await onRefreshAll();
    } catch (err) {
      console.error('Failed to leave room', err);
    }
  }

  async function handleToggleMute() {
    if (!activeRoomId) return;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    try {
      await apiRequest(`/api/voicerooms/${activeRoomId}/action`, {
        method: 'POST',
        body: JSON.stringify({ action: 'mute', isMuted: nextMuted }),
      });
      if (sendWebSocketEvent) {
        sendWebSocketEvent('voiceroom:speaking', {
          roomId: activeRoomId,
          isSpeaking: !nextMuted,
          volume: nextMuted ? 0 : 25,
        });
      }
    } catch (err) {
      console.error('Failed to toggle mute', err);
    }
  }

  async function handleToggleRaiseHand() {
    if (!activeRoomId) return;
    const nextHand = !hasRaisedHand;
    setHasRaisedHand(nextHand);
    try {
      await apiRequest(`/api/voicerooms/${activeRoomId}/action`, {
        method: 'POST',
        body: JSON.stringify({ action: 'raise_hand', raisedHand: nextHand }),
      });
    } catch (err) {
      console.error('Failed to raise hand', err);
    }
  }

  async function handleSendReaction(emoji: string) {
    if (!activeRoomId) return;
    // Add local floating emoji
    const newEmoji = {
      id: Math.random().toString(),
      emoji,
      x: Math.floor(Math.random() * 60) + 20,
      y: 80,
    };
    setFloatingEmojis((prev) => [...prev, newEmoji]);

    // Send via WebSocket or fallback REST
    if (sendWebSocketEvent) {
      sendWebSocketEvent('voiceroom:reaction', {
        roomId: activeRoomId,
        emoji,
      });
    } else {
      try {
        await apiRequest(`/api/voicerooms/${activeRoomId}/reaction`, {
          method: 'POST',
          body: JSON.stringify({ emoji }),
        });
      } catch (err) {
        console.error('Failed to send reaction', err);
      }
    }
  }

  async function handleSendRoomChat(e: React.FormEvent) {
    e.preventDefault();
    if (!activeRoomId || !chatInput.trim()) return;
    const content = chatInput.trim();
    setChatInput('');

    if (sendWebSocketEvent) {
      sendWebSocketEvent('voiceroom:chat', {
        roomId: activeRoomId,
        content,
      });
    } else {
      try {
        await apiRequest(`/api/voicerooms/${activeRoomId}/chat`, {
          method: 'POST',
          body: JSON.stringify({ content }),
        });
        await onRefreshAll();
      } catch (err) {
        console.error('Failed to send room chat', err);
      }
    }
  }

  // Host Action: Promote Listener to Speaker
  async function handlePromoteSpeaker(targetUserId: string) {
    if (!activeRoomId || !isHost) return;
    try {
      await apiRequest(`/api/voicerooms/${activeRoomId}/action`, {
        method: 'POST',
        body: JSON.stringify({ action: 'promote_speaker', targetUserId }),
      });
      setSelectedParticipant(null);
      await onRefreshAll();
    } catch (err) {
      console.error('Failed to promote speaker', err);
    }
  }

  // Host Action: Demote Speaker to Listener
  async function handleDemoteSpeaker(targetUserId: string) {
    if (!activeRoomId || !isHost) return;
    try {
      await apiRequest(`/api/voicerooms/${activeRoomId}/action`, {
        method: 'POST',
        body: JSON.stringify({ action: 'demote_listener', targetUserId }),
      });
      setSelectedParticipant(null);
      await onRefreshAll();
    } catch (err) {
      console.error('Failed to demote speaker', err);
    }
  }

  // Host Action: Mute Participant
  async function handleMuteParticipant(targetUserId: string) {
    if (!activeRoomId || !isHost) return;
    try {
      await apiRequest(`/api/voicerooms/${activeRoomId}/action`, {
        method: 'POST',
        body: JSON.stringify({ action: 'mute_participant', targetUserId }),
      });
      setSelectedParticipant(null);
      await onRefreshAll();
    } catch (err) {
      console.error('Failed to mute participant', err);
    }
  }

  // Host Action: End Room
  async function handleEndRoom() {
    if (!activeRoomId || !isHost) return;
    try {
      stopAudioCapture();
      await apiRequest(`/api/voicerooms/${activeRoomId}/action`, {
        method: 'POST',
        body: JSON.stringify({ action: 'end_room' }),
      });
      setShowEndRoomConfirm(false);
      setActiveRoomId(null);
      await onRefreshAll();
    } catch (err) {
      console.error('Failed to end room', err);
    }
  }

  // ===========================================================================
  // ACTIVE ROOM VIEW
  // ===========================================================================
  if (activeRoom) {
    const speakers = activeRoom.participants.filter(
      (p) => p.role === 'host' || p.role === 'speaker'
    );
    const listeners = activeRoom.participants.filter((p) => p.role === 'listener');
    const handRaisers = listeners.filter((p) => p.raisedHand);
    const activeSpeaker =
      speakers.find((s) => s.isSpeaking && !s.isMuted) || speakers[0] || null;

    return (
      <div className="w-full max-w-5xl mx-auto space-y-4 py-2">
        {/* ROOM TOP HEADER */}
        <div className="blin-surface rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-xl border border-white/10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-pink-500 to-violet-600 flex items-center justify-center text-white shrink-0 shadow-lg shadow-pink-500/20">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-display font-bold text-base sm:text-lg text-white truncate">
                  {activeRoom.title}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-pink-500/20 border border-pink-500/30 text-pink-300 text-[10px] font-bold uppercase tracking-wider shrink-0 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-ping" />
                  Live
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-violet-300 font-semibold">Hosted by @{activeRoom.hostUsername}</span>
                <span>·</span>
                <span className="text-cyan-300 font-medium">{activeRoom.topic}</span>
                <span>·</span>
                <span className="text-emerald-400 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                  {activeRoom.participants.length} presence active
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowInRoomChat((p) => !p)}
              className={`min-h-[38px] px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                showInRoomChat
                  ? 'bg-violet-600/30 text-violet-200 border border-violet-500/40'
                  : 'bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span className="hidden sm:inline">Room Chat</span>
            </button>

            {isHost ? (
              <button
                type="button"
                onClick={() => setShowEndRoomConfirm(true)}
                className="min-h-[38px] px-3.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-1.5"
              >
                <LogOut className="w-4 h-4" />
                <span>End Room</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleLeaveRoom}
                className="min-h-[38px] px-3.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-1.5"
              >
                <LogOut className="w-4 h-4" />
                <span>Leave</span>
              </button>
            )}
          </div>
        </div>

        {/* PRESENCE NOTIFICATION TOAST */}
        {presenceNotice && (
          <div className="blin-surface px-4 py-2 rounded-xl text-xs text-cyan-300 border border-cyan-500/30 flex items-center gap-2 animate-fade-in shadow-lg">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span>{presenceNotice}</span>
          </div>
        )}

        {/* MIC ERROR NOTIFICATION */}
        {micPermissionError && (
          <div className="blin-surface p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{micPermissionError}</span>
          </div>
        )}

        {/* MAIN STAGE + IN-ROOM CHAT GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* CENTER STAGE (2 COLS) */}
          <div className="lg:col-span-2 space-y-4">
            {/* ACTIVE SPEAKER GLOWING PODIUM */}
            <div className="blin-surface rounded-3xl p-6 sm:p-8 text-center relative overflow-hidden border border-violet-500/30 shadow-2xl">
              {/* Subtle ambient stage backlight */}
              <div className="absolute inset-0 bg-gradient-to-b from-violet-600/10 via-transparent to-cyan-600/5 pointer-events-none" />

              {/* Floating Emojis Overlay */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {floatingEmojis.map((item) => (
                  <div
                    key={item.id}
                    className="absolute text-3xl animate-bounce transition-all duration-1000 transform -translate-y-24"
                    style={{ left: `${item.x}%`, top: `${item.y}%` }}
                  >
                    {item.emoji}
                  </div>
                ))}
              </div>

              {activeSpeaker ? (
                <div className="relative space-y-4 max-w-sm mx-auto">
                  {/* Glowing circular avatar ring with pulse */}
                  <div className="relative mx-auto w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full blin-cta-gradient opacity-60 animate-ping" />
                    <div className="absolute inset-0 rounded-full blin-cta-gradient blur-md opacity-75" />
                    <div className="relative w-full h-full rounded-full p-1 bg-gradient-to-tr from-pink-500 via-violet-500 to-cyan-400">
                      <UserAvatar
                        name={activeSpeaker.displayName}
                        avatarUrl={activeSpeaker.avatarUrl}
                        size="xl"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="font-display font-extrabold text-lg sm:text-xl text-white">
                        {activeSpeaker.displayName}
                      </span>
                      {activeSpeaker.role === 'host' && (
                        <span className="px-2 py-0.5 rounded-full bg-violet-600 text-[10px] font-bold text-white uppercase tracking-wider flex items-center gap-1">
                          <Crown className="w-3 h-3 text-amber-300" />
                          Host
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-cyan-300 font-medium">@{activeSpeaker.username}</p>
                  </div>

                  {/* Real-time soundwave visualizer bars */}
                  <div className="pt-2 flex items-center justify-center gap-1.5 h-12">
                    {soundwaveLevels.map((lvl, idx) => (
                      <span
                        key={idx}
                        className="w-1.5 rounded-full bg-gradient-to-t from-violet-500 via-pink-400 to-cyan-400 transition-all duration-150"
                        style={{ height: `${lvl}%` }}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center space-y-2 text-slate-400">
                  <Headphones className="w-10 h-10 mx-auto opacity-40 text-violet-400" />
                  <p className="text-sm">No speaker currently on stage.</p>
                </div>
              )}
            </div>

            {/* SPEAKERS GRID */}
            <div className="blin-surface rounded-2xl p-4 space-y-3 border border-white/10">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                <span className="uppercase tracking-wider flex items-center gap-1.5 text-violet-300">
                  <Radio className="w-3.5 h-3.5" />
                  Stage Speakers ({speakers.length})
                </span>
                <span className="text-[11px] text-slate-400">
                  {isHost ? 'Click speaker to manage' : 'Click to view profile'}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {speakers.map((sp) => (
                  <button
                    key={sp.id}
                    type="button"
                    onClick={() => {
                      if (isHost && sp.userId !== user.id) {
                        setSelectedParticipant(sp);
                      } else {
                        onSelectUsername(sp.username);
                      }
                    }}
                    className="p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 transition-all flex flex-col items-center text-center space-y-2 relative group cursor-pointer"
                  >
                    <div className="relative">
                      <UserAvatar name={sp.displayName} avatarUrl={sp.avatarUrl} size="md" />
                      <span
                        className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] border border-black ${
                          sp.isMuted ? 'bg-rose-600 text-white' : 'bg-emerald-500 text-black'
                        }`}
                      >
                        {sp.isMuted ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                      </span>
                    </div>
                    <div className="min-w-0 w-full">
                      <div className="flex items-center justify-center gap-1">
                        <p className="text-xs font-bold text-white truncate">{sp.displayName}</p>
                        {sp.role === 'host' && <Crown className="w-3 h-3 text-amber-400 shrink-0" />}
                      </div>
                      <p className="text-[10px] text-slate-400 truncate">@{sp.username}</p>
                    </div>
                    {isHost && sp.userId !== user.id && (
                      <span className="text-[9px] text-cyan-300 opacity-0 group-hover:opacity-100 transition-opacity">
                        Host Controls
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* HAND RAISERS / SPEAKER REQUESTS (VISIBLE ESPECIALLY TO HOST) */}
            {handRaisers.length > 0 && (
              <div className="blin-surface rounded-2xl p-4 space-y-3 border border-amber-500/30 bg-amber-500/5">
                <div className="flex items-center justify-between text-xs font-bold text-amber-300">
                  <span className="uppercase tracking-wider flex items-center gap-1.5">
                    <Hand className="w-4 h-4 animate-bounce" />
                    Speaking Requests ({handRaisers.length})
                  </span>
                  {isHost && <span className="text-[11px] text-amber-400/80">Click invite to bring on stage</span>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {handRaisers.map((hr) => (
                    <div
                      key={hr.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-amber-500/20"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <UserAvatar name={hr.displayName} avatarUrl={hr.avatarUrl} size="sm" />
                        <div className="min-w-0 text-xs">
                          <p className="font-bold text-white truncate">{hr.displayName}</p>
                          <p className="text-slate-400 text-[10px] truncate">@{hr.username}</p>
                        </div>
                      </div>
                      {isHost && (
                        <button
                          type="button"
                          onClick={() => handlePromoteSpeaker(hr.userId)}
                          className="min-h-[30px] px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-[11px] font-bold flex items-center gap-1 shrink-0 shadow-md"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Invite to Stage</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AUDIENCE / LISTENERS GRID */}
            <div className="blin-surface rounded-2xl p-4 space-y-3 border border-white/10">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                <span className="uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-cyan-300" />
                  Audience & Listeners ({listeners.length})
                </span>
                <span className="text-[11px] text-slate-400">
                  {isHost ? 'Click listener to invite as speaker' : 'Real-time presence'}
                </span>
              </div>
              {listeners.length === 0 ? (
                <p className="text-xs text-slate-400 py-2">
                  All active room participants are currently on the speaking stage.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2.5">
                  {listeners.map((ls) => (
                    <button
                      key={ls.id}
                      type="button"
                      onClick={() => {
                        if (isHost) {
                          setSelectedParticipant(ls);
                        } else {
                          onSelectUsername(ls.username);
                        }
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 transition-colors cursor-pointer"
                    >
                      <UserAvatar name={ls.displayName} avatarUrl={ls.avatarUrl} size="xs" />
                      <span className="text-xs text-slate-200">{ls.displayName}</span>
                      {ls.raisedHand && (
                        <Hand className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* BOTTOM VOICE CONTROLS BAR (Mic, Raise Hand, Reactions) */}
            <div className="blin-surface rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xl border border-white/10">
              <div className="flex items-center gap-2">
                {/* Speaker Mic button */}
                {isSpeaker ? (
                  <button
                    type="button"
                    onClick={handleToggleMute}
                    className={`min-h-[44px] px-4 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                      isMuted
                        ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30'
                    }`}
                  >
                    {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    <span>{isMuted ? 'Mic Muted' : 'Speaking Live'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="min-h-[44px] px-4 rounded-xl text-xs font-bold flex items-center gap-2 bg-white/5 text-slate-400 border border-white/10 cursor-not-allowed"
                    title="Raise hand to request speaking permissions"
                  >
                    <Headphones className="w-4 h-4 text-cyan-300" />
                    <span>Listening</span>
                  </button>
                )}

                {/* Raise Hand toggle for listeners */}
                {!isSpeaker && (
                  <button
                    type="button"
                    onClick={handleToggleRaiseHand}
                    className={`min-h-[44px] px-4 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                      hasRaisedHand
                        ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/30'
                        : 'bg-white/10 text-slate-200 hover:bg-white/15'
                    }`}
                  >
                    <Hand className="w-4 h-4" />
                    <span>{hasRaisedHand ? 'Hand Raised' : 'Raise Hand'}</span>
                  </button>
                )}
              </div>

              {/* Floating Reaction Bar */}
              <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-white/10">
                {['💜', '🔥', '👏', '💯', '🎙️'].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleSendReaction(emoji)}
                    className="w-9 h-9 rounded-lg hover:bg-white/15 flex items-center justify-center text-lg hover:scale-125 transition-transform"
                    title={`Send ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* IN-ROOM LIVE TEXT CHAT (1 COL) */}
          {showInRoomChat && (
            <div className="blin-surface rounded-3xl p-4 flex flex-col justify-between h-[560px] shadow-2xl border border-white/10">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-cyan-300" />
                  <span className="font-display font-bold text-sm text-white">Live In-Room Chat</span>
                </div>
                <span className="text-[11px] text-slate-400">
                  {activeRoom.chatMessages.length} msgs
                </span>
              </div>

              {/* Chat list */}
              <div className="flex-1 overflow-y-auto py-3 space-y-3">
                {activeRoom.chatMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-4 space-y-2 text-slate-400">
                    <MessageSquare className="w-8 h-8 opacity-40" />
                    <p className="text-xs">
                      No messages yet. Say hello or share your thoughts with the speakers!
                    </p>
                  </div>
                ) : (
                  activeRoom.chatMessages.map((msg) => (
                    <div key={msg.id} className="flex items-start gap-2 text-xs">
                      <UserAvatar name={msg.displayName} avatarUrl={msg.avatarUrl} size="xs" />
                      <div className="flex-1 bg-white/[0.04] p-2 rounded-xl border border-white/5 space-y-0.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-cyan-300">@{msg.username}</span>
                          <span className="text-[10px] text-slate-500">
                            {formatClockTime(msg.createdAt)}
                          </span>
                        </div>
                        <p className="text-slate-200 leading-relaxed">{msg.content}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Chat form */}
              <form
                onSubmit={handleSendRoomChat}
                className="pt-2 border-t border-white/10 flex items-center gap-2"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Chat with voice room..."
                  className="flex-1 min-h-[38px] px-3.5 rounded-xl bg-[#050818] border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim()}
                  className="min-w-[38px] min-h-[38px] rounded-xl blin-cta-gradient text-white flex items-center justify-center disabled:opacity-40"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          )}
        </div>

        {/* HOST PARTICIPANT MANAGEMENT MODAL */}
        {selectedParticipant && isHost && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="blin-surface w-full max-w-sm rounded-3xl p-6 space-y-4 shadow-2xl border border-white/15">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-base text-white">Manage Participant</h3>
                <button
                  type="button"
                  onClick={() => setSelectedParticipant(null)}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/10">
                <UserAvatar
                  name={selectedParticipant.displayName}
                  avatarUrl={selectedParticipant.avatarUrl}
                  size="md"
                />
                <div>
                  <p className="font-bold text-white text-sm">{selectedParticipant.displayName}</p>
                  <p className="text-xs text-slate-400">@{selectedParticipant.username}</p>
                  <span className="inline-block px-2 py-0.5 rounded-full bg-violet-600/30 text-[10px] text-violet-300 font-bold uppercase mt-1">
                    {selectedParticipant.role}
                  </span>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                {selectedParticipant.role === 'listener' ? (
                  <button
                    type="button"
                    onClick={() => handlePromoteSpeaker(selectedParticipant.userId)}
                    className="w-full min-h-[42px] px-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold flex items-center justify-center gap-2"
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>Invite as Stage Speaker</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => handleDemoteSpeaker(selectedParticipant.userId)}
                      className="w-full min-h-[42px] px-4 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-bold flex items-center justify-center gap-2"
                    >
                      <UserMinus className="w-4 h-4" />
                      <span>Move to Audience / Listener</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMuteParticipant(selectedParticipant.userId)}
                      className="w-full min-h-[42px] px-4 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-bold flex items-center justify-center gap-2"
                    >
                      <MicOff className="w-4 h-4" />
                      <span>Mute Participant Microphone</span>
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => {
                    onSelectUsername(selectedParticipant.username);
                    setSelectedParticipant(null);
                  }}
                  className="w-full min-h-[38px] px-4 rounded-xl bg-transparent hover:bg-white/5 text-cyan-300 text-xs font-medium"
                >
                  View Profile
                </button>
              </div>
            </div>
          </div>
        )}

        {/* HOST END ROOM CONFIRMATION MODAL */}
        {showEndRoomConfirm && isHost && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="blin-surface w-full max-w-sm rounded-3xl p-6 space-y-4 shadow-2xl border border-rose-500/30">
              <div className="w-12 h-12 rounded-2xl bg-rose-600/20 text-rose-400 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="text-center space-y-1.5">
                <h3 className="font-display font-bold text-lg text-white">End Voice Room?</h3>
                <p className="text-xs text-slate-400">
                  This will end the audio stage for all {activeRoom.participants.length} participants and close the room.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEndRoomConfirm(false)}
                  className="flex-1 min-h-[42px] rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleEndRoom}
                  className="flex-1 min-h-[42px] rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-600/30"
                >
                  Yes, End Room
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ===========================================================================
  // ROOMS LIST / LOBBY VIEW
  // ===========================================================================
  return (
    <div className="space-y-6">
      {/* Header & Create Voice Room Trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="w-6 h-6 text-pink-400 animate-pulse" />
            <h1 className="font-display font-extrabold text-2xl text-white">Live Voice Rooms</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Drop in, listen, raise your hand, and speak freely with real BLiN creators and members.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="min-h-[42px] px-5 rounded-xl blin-cta-gradient text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-purple-500/25 self-start whitespace-nowrap cursor-pointer hover:scale-105 transition-transform"
        >
          <Plus className="w-4 h-4" />
          <span>Start Voice Room</span>
        </button>
      </div>

      {/* ROOMS DIRECTORY */}
      {rooms.length === 0 ? (
        <div className="blin-surface rounded-3xl p-10 text-center space-y-4 border border-white/10">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-pink-500/20 to-violet-600/20 border border-pink-500/30 flex items-center justify-center text-pink-400">
            <Radio className="w-8 h-8" />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h3 className="font-display font-bold text-lg text-white">No Live Rooms Right Now</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Start the first live voice room on BLiN! Invite friends or let community members drop in to talk tech, music, design, or life.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="min-h-[44px] px-6 rounded-xl blin-cta-gradient text-white font-semibold text-xs shadow-lg shadow-purple-500/20"
          >
            Create Your Voice Stage
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rooms.map((room) => {
            const speakerCount = room.participants.filter(
              (p) => p.role === 'host' || p.role === 'speaker'
            ).length;

            return (
              <div
                key={room.id}
                className="blin-surface rounded-3xl p-5 flex flex-col justify-between space-y-4 border border-white/10 hover:border-violet-500/40 transition-colors shadow-xl"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full bg-pink-500/20 border border-pink-500/30 text-pink-300 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-ping" />
                      Live Stage
                    </span>
                    <span className="text-xs text-cyan-300 font-semibold">{room.topic}</span>
                  </div>

                  <h3 className="font-display font-bold text-lg text-white leading-snug">
                    {room.title}
                  </h3>
                  {room.description && (
                    <p className="text-xs text-slate-300 line-clamp-2">{room.description}</p>
                  )}
                </div>

                {/* Host & Participants Preview */}
                <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <UserAvatar
                      name={room.hostDisplayName}
                      avatarUrl={room.hostAvatar}
                      size="sm"
                    />
                    <div className="min-w-0 text-xs">
                      <p className="font-bold text-white truncate">{room.hostDisplayName}</p>
                      <p className="text-slate-400 text-[11px] truncate">@{room.hostUsername}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right text-xs">
                      <p className="text-emerald-400 font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span>{room.participants.length} online</span>
                      </p>
                      <p className="text-slate-400 text-[10px]">
                        {speakerCount} speaking
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleJoinRoom(room.id)}
                      className="min-h-[38px] px-4 rounded-xl blin-cta-gradient text-white text-xs font-bold shadow-md hover:scale-105 transition-transform cursor-pointer"
                    >
                      Join Stage
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE ROOM MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="blin-surface w-full max-w-md rounded-3xl p-6 space-y-4 shadow-2xl border border-white/15">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-pink-400" />
                <h3 className="font-display font-bold text-lg text-white">Start Voice Stage</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRoom} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Room Title *
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Late Night Creator Jam & QA"
                  className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#070B22] border border-white/15 text-sm text-white focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Topic</label>
                <select
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  className="w-full min-h-[42px] px-3 rounded-xl bg-[#070B22] border border-white/15 text-xs text-white"
                >
                  <option value="Creators & Tech">Creators & Tech</option>
                  <option value="Music & Audio">Music & Audio</option>
                  <option value="Design & Art">Design & Art</option>
                  <option value="Gaming & Esports">Gaming & Esports</option>
                  <option value="Community Hangout">Community Hangout</option>
                  <option value="Faith & Purpose">Faith & Purpose</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  rows={3}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="What will you be discussing? Who should jump in?"
                  className="w-full p-3 rounded-xl bg-[#070B22] border border-white/15 text-xs text-white focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full min-h-[44px] rounded-xl blin-cta-gradient text-white text-xs font-bold shadow-lg shadow-purple-500/25 cursor-pointer"
                >
                  Go Live on Stage
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
