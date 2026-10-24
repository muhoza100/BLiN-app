import React, { useState } from 'react';
import {
  Video,
  Sparkles,
  X,
  Play,
  RotateCw,
  Film,
  Upload,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  Send,
} from 'lucide-react';
import { UserAccount } from '../types/blin';
import { apiRequest } from '../lib/api';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';

interface AiVideoStudioModalProps {
  user: UserAccount;
  onClose: () => void;
  onVideoPublished?: () => void;
}

const SAMPLE_PROMPTS = [
  'Futuristic neon-lit cyberpunk alleyway with rain puddles reflecting violet and cyan streetlights, cinematic camera glide.',
  'Lo-fi anime style aesthetic creator studio with city skyline during golden hour sunset, plants on balcony gently swaying.',
  'Holographic street DJ performing in an underground rave with kinetic magenta laser beams and pulsing bass crowds.',
  'High-speed rollerblader in glowing reflective streetwear zooming down a bridge at dusk with neon motion trails.',
];

export function AiVideoStudioModal({ user, onClose, onVideoPublished }: AiVideoStudioModalProps) {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9'>('9:16');
  const [duration, setDuration] = useState<'5s' | '10s'>('5s');
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;

    setError('');
    setSuccessMsg('');
    setGenerating(true);
    setGeneratedVideoUrl(null);

    try {
      const res = await apiRequest<{
        videoUrl: string;
        aspectRatio: string;
        prompt: string;
      }>('/api/ai/generate-video', {
        method: 'POST',
        body: JSON.stringify({
          prompt: prompt.trim(),
          aspectRatio,
          duration,
        }),
      });

      setGeneratedVideoUrl(res.videoUrl);
      setSuccessMsg('Video rendered successfully with Gemini Omni 1.1 Flash!');

      // Persist to Firestore collection `generated_videos` per firebase-integration-rpc
      try {
        await addDoc(collection(db, 'generated_videos'), {
          userId: user.id,
          prompt: prompt.trim(),
          videoUrl: res.videoUrl.slice(0, 1000) + '...', // blueprint constraint
          aspectRatio,
          duration,
          createdAt: new Date().toISOString(),
        });
      } catch (fsErr) {
        handleFirestoreError(fsErr, OperationType.CREATE, 'generated_videos');
      }
    } catch (err: any) {
      setError(
        err?.message ||
          'Video generation encountered an issue. Ensure your prompt is descriptive and retry.'
      );
    } finally {
      setGenerating(false);
    }
  }

  async function handlePublishToReels() {
    if (!generatedVideoUrl) return;
    setPublishing(true);
    try {
      await apiRequest('/api/posts', {
        method: 'POST',
        body: JSON.stringify({
          kind: 'spotlight',
          postType: 'spotlight_reel',
          caption: prompt.slice(0, 150) + ' #AIGenerated #OmniFlash #BLiN',
          mediaUrl: generatedVideoUrl,
          mediaType: 'video',
          aspectRatio: aspectRatio === '9:16' ? 'vertical' : 'standard',
          videoDuration: `0:0${duration === '10s' ? '10' : '5'}`,
          audioAttribution: `Omni Flash Synth - @${user.username}`,
          topics: ['OmniAI', 'CreatorHustle', 'Reels'],
        }),
      });

      setSuccessMsg('Published directly to BLiN Spotlight & Reels!');
      if (onVideoPublished) onVideoPublished();
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err?.message || 'Failed to publish video to Reels.');
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xl animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-[#09061c]/95 border border-pink-500/30 rounded-3xl shadow-2xl p-5 sm:p-7 space-y-5 text-white max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl blin-reels-gradient flex items-center justify-center shadow-lg shadow-pink-500/30">
              <Film className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-display font-extrabold text-lg sm:text-xl text-white flex items-center gap-2">
                Gemini Omni Flash Video Studio
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 font-mono font-bold">
                  gemini-omni-1.1-flash
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Generate high-definition cinematic video clips from text prompts via Interactions API
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-xs flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Video Preview If Generated */}
        {generatedVideoUrl ? (
          <div className="space-y-4">
            <div
              className={`relative mx-auto rounded-2xl overflow-hidden bg-black/90 border border-pink-500/30 shadow-2xl ${
                aspectRatio === '9:16' ? 'w-64 aspect-[9/16]' : 'w-full aspect-[16/9]'
              }`}
            >
              <video
                src={generatedVideoUrl}
                controls
                autoPlay
                loop
                playsInline
                className="w-full h-full object-cover"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={handlePublishToReels}
                disabled={publishing}
                className="flex-1 py-3.5 rounded-2xl blin-cta-gradient text-white font-display font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-pink-500/30 hover:opacity-95 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>{publishing ? 'Publishing...' : 'Publish to BLiN Spotlight Reels'}</span>
              </button>

              <button
                type="button"
                onClick={() => setGeneratedVideoUrl(null)}
                className="px-5 py-3.5 rounded-2xl bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2"
              >
                <RotateCw className="w-4 h-4" />
                <span>Generate Another</span>
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleGenerate} className="space-y-4">
            {/* Prompt input */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300">
                Text Prompt for Omni Flash Video
              </label>
              <textarea
                required
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe your scene in vivid cinematic detail (camera angle, lighting, colors, motion)..."
                className="w-full rounded-2xl bg-[#060417] border border-white/15 p-3.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-pink-500/50 resize-none transition-colors"
              />
            </div>

            {/* Quick Inspiration Pills */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Creative Starters:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {SAMPLE_PROMPTS.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setPrompt(p)}
                    className="text-[11px] px-3 py-1 rounded-full bg-white/5 hover:bg-pink-500/20 border border-white/10 hover:border-pink-500/30 text-slate-300 hover:text-white transition-colors text-left line-clamp-1"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Aspect Ratio & Duration options */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-pink-400" />
                  Aspect Ratio
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAspectRatio('9:16')}
                    className={`py-2 rounded-xl text-xs font-bold transition-all border ${
                      aspectRatio === '9:16'
                        ? 'blin-reels-gradient border-pink-400 text-white shadow-md'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                    }`}
                  >
                    📱 9:16 (Reels)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAspectRatio('16:9')}
                    className={`py-2 rounded-xl text-xs font-bold transition-all border ${
                      aspectRatio === '16:9'
                        ? 'blin-reels-gradient border-pink-400 text-white shadow-md'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                    }`}
                  >
                    🖥️ 16:9 (Landscape)
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  Clip Duration
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDuration('5s')}
                    className={`py-2 rounded-xl text-xs font-bold transition-all border ${
                      duration === '5s'
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-600 border-cyan-400 text-white shadow-md'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                    }`}
                  >
                    5 Seconds
                  </button>
                  <button
                    type="button"
                    onClick={() => setDuration('10s')}
                    className={`py-2 rounded-xl text-xs font-bold transition-all border ${
                      duration === '10s'
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-600 border-cyan-400 text-white shadow-md'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                    }`}
                  >
                    10 Seconds
                  </button>
                </div>
              </div>
            </div>

            {/* Action Button */}
            <button
              type="submit"
              disabled={generating || !prompt.trim()}
              className="w-full py-4 rounded-2xl blin-cta-gradient text-white font-display font-black text-sm sm:text-base flex items-center justify-center gap-2 shadow-xl shadow-pink-500/30 hover:opacity-95 active:scale-[0.99] transition-all disabled:opacity-50"
            >
              {generating ? (
                <>
                  <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  <span>Synthesizing Video with Omni Flash...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 text-white" />
                  <span>Generate Video (Omni 1.1 Flash)</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
