import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  ShieldAlert,
  Flame,
  Lightbulb,
  Copy,
  Check,
  RotateCcw,
  Bot,
  Zap,
  ArrowRight,
  TrendingUp,
  X,
} from 'lucide-react';
import { UserAccount, AIMessage } from '../types/blin';
import { apiRequest, formatClockTime } from '../lib/api';

interface StreetSmartAIProps {
  user: UserAccount;
  onClose?: () => void;
  isModal?: boolean;
}

const STREET_PROMPTS = [
  {
    icon: '🛡️',
    title: 'Spot the Scam',
    prompt: 'Someone in my DMs wants to pay me upfront to post their link or crypto. Is this a scam and how do I test them?',
  },
  {
    icon: '🔥',
    title: 'Punchy Reel Caption',
    prompt: 'Give me 3 street-smart, viral captions for my late-night work grind reel. Keep it authentic and gritty.',
  },
  {
    icon: '🧊',
    title: 'Handling Disrespect',
    prompt: 'Someone left a rude comment trying to clout chase off my post. How do I handle it without crashing out or looking weak?',
  },
  {
    icon: '💼',
    title: 'Real Creator Hustle',
    prompt: 'What is the real street-smart way to build genuine followers and earn BLiN points without begging for follows?',
  },
  {
    icon: '🏙️',
    title: 'City Street Smarts',
    prompt: 'Give me your top 5 street-smart rules for staying safe, confident, and aware in busy nightlife or unfamiliar neighborhoods.',
  },
];

export function StreetSmartAI({ user, onClose, isModal = false }: StreetSmartAIProps) {
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: `Yo @${user.username}! I'm Ace, your street-smart AI on BLiN. 
No robotic PR talk here — just 100% authentic street wisdom, creator hustle advice, scam radar, and real-talk strategy. 

Hit me with whatever you're dealing with: an internet hater, a sketchy DM, a reel caption that needs flavor, or rules of the street. What's on your mind?`,
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function handleSend(textToSend?: string) {
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    const userMsg: AIMessage = {
      id: 'u_' + Date.now(),
      role: 'user',
      text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await apiRequest<{ reply: string }>('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ message: text }),
      });

      const botMsg: AIMessage = {
        id: 'a_' + Date.now(),
        role: 'assistant',
        text: res.reply,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      const botMsg: AIMessage = {
        id: 'a_' + Date.now(),
        role: 'assistant',
        text: 'Street rule #1: Even the best connections hit static. Give it a second and shoot that question again, fam.',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, botMsg]);
    } finally {
      setLoading(false);
    }
  }

  function handleCopy(id: string, text: string) {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  }

  const containerClasses = isModal
    ? 'blin-surface w-full max-w-2xl h-[85vh] rounded-3xl p-5 flex flex-col justify-between shadow-2xl border border-violet-500/30'
    : 'blin-surface w-full max-w-3xl mx-auto min-h-[calc(100vh-160px)] rounded-3xl p-5 sm:p-6 flex flex-col justify-between shadow-2xl border border-white/10';

  return (
    <div className={containerClasses}>
      {/* HEADER */}
      <div className="flex items-center justify-between pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-violet-600 via-pink-600 to-cyan-400 p-0.5 shadow-lg shadow-pink-500/20">
              <div className="w-full h-full rounded-2xl bg-[#06091B] flex items-center justify-center">
                <Zap className="w-5 h-5 text-cyan-300 animate-pulse" />
              </div>
            </div>
            <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-[#06091B]" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display font-extrabold text-lg text-white">Ace · Street-Smart AI</h2>
              <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-pink-500/20 to-violet-500/20 text-pink-300 text-[10px] font-bold border border-pink-500/30">
                Grounded & Savvy
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Real-talk creator guidance, scam radar & street wisdom
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setMessages([
                {
                  id: 'welcome_' + Date.now(),
                  role: 'assistant',
                  text: 'Fresh slate. What problem or hustle move are we breaking down now?',
                  timestamp: new Date().toISOString(),
                },
              ])
            }
            className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
            title="Reset Chat"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* QUICK PRESETS CAROUSEL (If few messages) */}
      {messages.length <= 2 && (
        <div className="py-3 overflow-x-auto no-scrollbar flex items-center gap-2">
          {STREET_PROMPTS.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSend(p.prompt)}
              className="px-3 py-1.5 rounded-full bg-white/[0.04] hover:bg-violet-600/20 border border-white/10 hover:border-violet-500/40 text-xs font-semibold text-slate-200 hover:text-cyan-200 transition-colors shrink-0 flex items-center gap-1.5"
            >
              <span>{p.icon}</span>
              <span>{p.title}</span>
            </button>
          ))}
        </div>
      )}

      {/* MESSAGES STREAM */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
        {messages.map((m) => {
          const isUser = m.role === 'user';
          return (
            <div
              key={m.id}
              className={`flex items-start gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-pink-500 to-violet-600 flex items-center justify-center text-white shrink-0 mt-0.5 shadow-md">
                  <Zap className="w-4 h-4 text-cyan-200" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed relative group ${
                  isUser
                    ? 'blin-cta-gradient text-white rounded-br-none shadow-md'
                    : 'bg-[#090D28] border border-white/10 text-slate-100 rounded-bl-none shadow-lg'
                }`}
              >
                <p className="whitespace-pre-wrap">{m.text}</p>
                <div className="flex items-center justify-between pt-2 mt-1 border-t border-white/10 text-[10px] text-slate-400">
                  <span>{formatClockTime(m.timestamp)}</span>
                  {!isUser && (
                    <button
                      type="button"
                      onClick={() => handleCopy(m.id, m.text)}
                      className="hover:text-white flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-3"
                    >
                      {copiedId === m.id ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>{copiedId === m.id ? 'Copied' : 'Copy'}</span>
                    </button>
                  )}
                </div>
              </div>

              {isUser && (
                <div className="w-8 h-8 rounded-xl bg-violet-600/40 border border-violet-400/30 flex items-center justify-center font-bold text-xs text-white shrink-0 mt-0.5">
                  {user.displayName.slice(0, 1)}
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-pink-500 to-violet-600 flex items-center justify-center text-white shrink-0 animate-pulse">
              <Zap className="w-4 h-4 text-cyan-200" />
            </div>
            <div className="px-4 py-3 rounded-2xl bg-[#090D28] border border-white/10 text-xs text-cyan-300 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <span>Ace is thinking street-smart...</span>
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* INPUT BAR */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="pt-3 border-t border-white/10 flex items-center gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Ace for real-talk advice, caption hooks, scam checks..."
          className="flex-1 min-h-[44px] px-4 rounded-xl bg-[#070A1E] border border-white/15 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="min-h-[44px] px-5 rounded-xl blin-cta-gradient text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-purple-500/20 disabled:opacity-40 hover:scale-105 active:scale-95 transition-transform"
        >
          <Send className="w-4 h-4" />
          <span className="hidden sm:inline">Ask Ace</span>
        </button>
      </form>
    </div>
  );
}
