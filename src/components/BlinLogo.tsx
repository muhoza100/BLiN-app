import React from 'react';
import { X, ShieldCheck, FileText, Users } from 'lucide-react';
import {
  BLIN_TERMS_SECTIONS,
  BLIN_PRIVACY_POLICY,
  BLIN_COMMUNITY_GUIDELINES,
} from '../data/legalContent';

export function BlinLogo({
  size = 'md',
  showWordmark = true,
}: {
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
}) {
  const iconDims =
    size === 'sm' ? 'w-8 h-8 rounded-lg' : size === 'lg' ? 'w-14 h-14 rounded-2xl' : 'w-10 h-10 rounded-xl';
  const wordSize =
    size === 'sm' ? 'text-xl' : size === 'lg' ? 'text-4xl' : 'text-2xl';

  return (
    <div className="inline-flex items-center gap-2.5 select-none shrink-0">
      <div
        className={`${iconDims} relative flex items-center justify-center overflow-hidden shadow-lg shadow-violet-600/20`}
      >
        <svg viewBox="0 0 64 64" className="w-full h-full" aria-hidden="true">
          <defs>
            <linearGradient id="blinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#EC4899" />
              <stop offset="45%" stopColor="#8B5CF6" />
              <stop offset="100%" stopColor="#06B6D4" />
            </linearGradient>
          </defs>
          <rect width="64" height="64" rx="16" fill="url(#blinGrad)" />
          {/* Stylized B silhouette with shooting spark cutout */}
          <path
            d="M16 12h19c8.5 0 14 4.5 14 11.2 0 4.6-2.8 8-6.8 9.5 5 1.4 8.3 5.3 8.3 10.6C50.5 50.8 44.2 55 34.8 55H16V12z"
            fill="rgba(255,255,255,0.22)"
          />
          <path
            d="M13 51L33 27l4 4L13 51z"
            fill="#070A1E"
          />
          <path
            d="M36 19l2.4 5.6L44 27l-5.6 2.4L36 35l-2.4-5.6L28 27l5.6-2.4L36 19z"
            fill="#F0ABFC"
          />
        </svg>
      </div>
      {showWordmark && (
        <span className={`font-display font-extrabold tracking-tight text-white ${wordSize} whitespace-nowrap`}>
          BL<span className="text-violet-400">i</span>N
        </span>
      )}
    </div>
  );
}

export function UserAvatar({
  name,
  avatarUrl,
  size = 'md',
  isOnline,
}: {
  name: string;
  avatarUrl?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  isOnline?: boolean | null;
}) {
  const dims =
    size === 'xs'
      ? 'w-7 h-7 text-xs'
      : size === 'sm'
      ? 'w-9 h-9 text-sm'
      : size === 'lg'
      ? 'w-14 h-14 text-lg'
      : size === 'xl'
      ? 'w-20 h-20 text-2xl'
      : 'w-11 h-11 text-base';

  const initials = (name || 'B')
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className={`relative shrink-0 ${dims}`}>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name}
          referrerPolicy="no-referrer"
          className="w-full h-full rounded-full object-cover border border-white/15"
        />
      ) : (
        <div className="w-full h-full rounded-full bg-gradient-to-br from-violet-600 via-blue-600 to-cyan-500 flex items-center justify-center font-display font-bold text-white border border-white/15">
          {initials}
        </div>
      )}
      {isOnline === true && (
        <span
          title="Online"
          className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-[#070A1E]"
        />
      )}
    </div>
  );
}

export function LegalModal({
  docType,
  onClose,
}: {
  docType: 'terms' | 'privacy' | 'guidelines' | null;
  onClose: () => void;
}) {
  if (!docType) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="blin-surface w-full max-w-2xl max-h-[86vh] rounded-2xl flex flex-col overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            {docType === 'terms' && <FileText className="w-5 h-5 text-violet-400" />}
            {docType === 'privacy' && <ShieldCheck className="w-5 h-5 text-cyan-400" />}
            {docType === 'guidelines' && <Users className="w-5 h-5 text-blue-400" />}
            <div>
              <h2 className="font-display font-bold text-lg">
                {docType === 'terms'
                  ? 'BLiN Terms and Conditions'
                  : docType === 'privacy'
                  ? 'BLiN Privacy Policy'
                  : 'BLiN Community Guidelines'}
              </h2>
              <p className="text-xs text-slate-400">
                {docType === 'terms'
                  ? 'Version 1.0 · Effective date: October 18, 2026'
                  : 'Transparency & User Rights'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-white/10 transition-colors"
            aria-label="Close legal document"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 text-sm leading-relaxed text-slate-200">
          {docType === 'terms' && (
            <>
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-1.5">
                <p className="font-semibold text-white">
                  Welcome to BLiN — Blend In. Be yourself. Find your people.
                </p>
                <p className="text-slate-300 text-xs leading-relaxed">
                  These Terms and Conditions (“Terms”) govern your access to and use of BLiN,
                  including its social feed, messaging, short videos, creator tools, profiles,
                  groups and communities. By creating an account or using BLiN, you agree to these
                  Terms.
                </p>
              </div>
              {BLIN_TERMS_SECTIONS.map((sec) => (
                <section key={sec.number} className="space-y-2">
                  <h3 className="font-display font-semibold text-base text-white">{sec.number}</h3>
                  {sec.intro && <p className="text-slate-300">{sec.intro}</p>}
                  {sec.paragraphs?.map((p, idx) => (
                    <p key={idx} className="text-slate-300">
                      {p}
                    </p>
                  ))}
                  {sec.bullets && (
                    <ul className="list-disc pl-5 space-y-1 text-slate-300">
                      {sec.bullets.map((b, idx) => (
                        <li key={idx}>{b}</li>
                      ))}
                    </ul>
                  )}
                  {sec.footer && <p className="text-xs text-cyan-300/90 pt-1">{sec.footer}</p>}
                </section>
              ))}
            </>
          )}

          {docType === 'privacy' && (
            <div className="space-y-4">
              {BLIN_PRIVACY_POLICY.map((item) => (
                <section key={item.title} className="space-y-1.5">
                  <h3 className="font-display font-semibold text-base text-white">{item.title}</h3>
                  <p className="text-slate-300">{item.body}</p>
                </section>
              ))}
            </div>
          )}

          {docType === 'guidelines' && (
            <div className="space-y-3">
              <p className="text-slate-300">
                Every person on BLiN helps keep communities welcoming, creative, and safe:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-slate-200">
                {BLIN_COMMUNITY_GUIDELINES.map((rule, idx) => (
                  <li key={idx}>{rule}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-white/10 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl blin-cta-gradient text-white font-semibold text-sm hover:opacity-95 transition-opacity whitespace-nowrap"
          >
            Done Reading
          </button>
        </div>
      </div>
    </div>
  );
}
