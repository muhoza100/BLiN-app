import React, { useState, useEffect } from 'react';
import {
  User,
  AtSign,
  Mail,
  Calendar,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Info,
} from 'lucide-react';
import { BlinLogo, LegalModal } from './BlinLogo';
import { apiRequest, setStoredToken } from '../lib/api';
import { UserAccount } from '../types/blin';

interface AuthViewProps {
  onAuthenticated: (user: UserAccount) => void;
}

export function AuthView({ onAuthenticated }: AuthViewProps) {
  const [mode, setMode] = useState<'register' | 'login'>('register');

  // Login fields
  const [identifier, setIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register fields
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [email, setEmail] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [password, setPassword] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(true);

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [legalDoc, setLegalDoc] = useState<'terms' | 'privacy' | 'guidelines' | null>(null);

  useEffect(() => {
    if (mode !== 'register') return;
    const clean = username.trim().toLowerCase().replace(/^@/, '');
    if (clean.length < 3) {
      setUsernameAvailable(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await apiRequest<{ available: boolean }>(
          `/api/auth/check-username?username=${encodeURIComponent(clean)}`
        );
        setUsernameAvailable(res.available);
      } catch {
        setUsernameAvailable(null);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [username, mode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (mode === 'login') {
        const res = await apiRequest<{ token: string; user: UserAccount }>('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ identifier, password: loginPassword }),
        });
        setStoredToken(res.token);
        onAuthenticated(res.user);
      } else {
        const res = await apiRequest<{ token: string; user: UserAccount }>('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            displayName,
            username,
            email,
            dateOfBirth,
            password,
            agreedToTerms,
          }),
        });
        setStoredToken(res.token);
        onAuthenticated(res.user);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to complete authentication.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen w-full genz-background text-white relative overflow-hidden flex items-center justify-center px-4 py-10">
      {/* Gen Z ambient corner glows */}
      <div
        className="pointer-events-none fixed -top-36 -left-36 w-96 h-96 rounded-full opacity-45 blur-3xl"
        style={{ background: 'radial-gradient(circle, #EC4899 0%, #8B5CF6 60%, transparent 100%)' }}
      />
      <div
        className="pointer-events-none fixed -bottom-36 -right-36 w-96 h-96 rounded-full opacity-35 blur-3xl"
        style={{ background: 'radial-gradient(circle, #06B6D4 0%, #EC4899 65%, transparent 100%)' }}
      />

      <div className="relative z-10 w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        {/* Left Brand Showcase on Desktop */}
        <div className="hidden lg:flex lg:col-span-6 flex-col justify-center space-y-6 pr-6">
          <BlinLogo size="lg" />
          <div className="space-y-3">
            <h1 className="font-display font-extrabold text-4xl xl:text-5xl leading-tight tracking-tight [text-wrap:balance]">
              Blend In. Be yourself.{' '}
              <span className="bg-gradient-to-r from-violet-400 via-blue-400 to-cyan-300 bg-clip-text text-transparent">
                Find your people.
              </span>
            </h1>
            <p className="text-slate-300 text-base leading-relaxed max-w-md">
              Real connections, private conversations with live delivery and seen controls,
              Spotlight short videos, communities, transparent BLiN Points, and 140+ granular
              privacy and personalization settings.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 max-w-lg">
            <div className="p-4 rounded-2xl bg-[#0D1330]/90 border border-violet-500/20 space-y-1">
              <p className="font-display font-bold text-sm text-white">Zero Fake Accounts</p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Every profile, post, message, and point on BLiN comes strictly from real accounts.
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-[#0D1330]/90 border border-cyan-500/20 space-y-1">
              <p className="font-display font-bold text-sm text-white">Privacy Reciprocity</p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Control online status, last seen, typing indicators, and blue ticks on your terms.
              </p>
            </div>
          </div>
        </div>

        {/* Auth Form Card */}
        <div className="lg:col-span-6 w-full max-w-md mx-auto">
          <div className="bg-[#0B102B]/95 border border-blue-500/25 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex flex-col items-center text-center space-y-2 lg:hidden">
              <BlinLogo size="md" />
              <p className="text-xs text-slate-300">Blend In. Be yourself. Find your people.</p>
            </div>

            {/* Segmented Sign In / Create Account Switch */}
            <div className="grid grid-cols-2 p-1 rounded-2xl bg-[#070A1E] border border-blue-500/20">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError('');
                }}
                className={`min-h-[44px] rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                  mode === 'login'
                    ? 'blin-cta-gradient text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError('');
                }}
                className={`min-h-[44px] rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                  mode === 'register'
                    ? 'blin-cta-gradient text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Create account
              </button>
            </div>

            <div className="text-center space-y-1">
              <h2 className="font-display font-extrabold text-2xl sm:text-3xl tracking-tight">
                {mode === 'register' ? (
                  <>
                    Create <span className="text-violet-400">your</span>{' '}
                    <span className="text-cyan-400">account</span>
                  </>
                ) : (
                  'Welcome back!'
                )}
              </h2>
              <p className="text-xs sm:text-sm text-slate-400">
                {mode === 'register'
                  ? 'Join BLiN and start connecting, creating and exploring your world.'
                  : 'Sign in to continue to your world.'}
              </p>
            </div>

            {/* Firebase Google One-Click Sign In */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={async () => {
                  setError('');
                  setSubmitting(true);
                  try {
                    const { auth, googleProvider } = await import('../lib/firebase');
                    const { signInWithPopup } = await import('firebase/auth');
                    const cred = await signInWithPopup(auth, googleProvider);
                    if (cred.user) {
                      const res = await apiRequest<{ token: string; user: UserAccount }>(
                        '/api/auth/firebase-login',
                        {
                          method: 'POST',
                          body: JSON.stringify({
                            uid: cred.user.uid,
                            email: cred.user.email,
                            displayName: cred.user.displayName,
                            photoURL: cred.user.photoURL,
                          }),
                        }
                      );
                      setStoredToken(res.token);
                      onAuthenticated(res.user);
                    }
                  } catch (err: any) {
                    console.error('Firebase Auth error:', err);
                    setError(err?.message || 'Google Sign-in failed. Please try again.');
                  } finally {
                    setSubmitting(false);
                  }
                }}
                disabled={submitting}
                className="w-full min-h-[46px] rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-semibold text-xs sm:text-sm flex items-center justify-center gap-3 px-4 shadow-lg transition-transform active:scale-[0.99] disabled:opacity-50"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google (Firebase Auth)</span>
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">or with BLiN account</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {mode === 'register' ? (
                <>
                  {/* Display Name */}
                  <label className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-[#070B22] border border-blue-500/30 focus-within:border-cyan-400 transition-colors">
                    <User className="w-5 h-5 text-violet-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="block text-[11px] text-slate-400">Display name</span>
                      <input
                        type="text"
                        required
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="e.g. Alex"
                        className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
                      />
                    </div>
                  </label>

                  {/* Username */}
                  <label className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-[#070B22] border border-blue-500/30 focus-within:border-cyan-400 transition-colors">
                    <AtSign className="w-5 h-5 text-violet-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="block text-[11px] text-slate-400">Username</span>
                      <input
                        type="text"
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value.replace(/\s+/g, ''))}
                        placeholder="Choose a unique username"
                        className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
                      />
                    </div>
                    {usernameAvailable === true && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 shrink-0">
                        <CheckCircle2 className="w-4 h-4" />
                        Available
                      </span>
                    )}
                    {usernameAvailable === false && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-400 shrink-0">
                        <AlertCircle className="w-4 h-4" />
                        Unavailable
                      </span>
                    )}
                  </label>

                  {/* Email */}
                  <label className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-[#070B22] border border-blue-500/30 focus-within:border-cyan-400 transition-colors">
                    <Mail className="w-5 h-5 text-violet-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="block text-[11px] text-slate-400">Email address</span>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
                      />
                    </div>
                  </label>

                  {/* Date of Birth */}
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-[#070B22] border border-blue-500/30 focus-within:border-cyan-400 transition-colors">
                      <Calendar className="w-5 h-5 text-violet-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="block text-[11px] text-slate-400">Date of birth</span>
                        <input
                          type="date"
                          required
                          value={dateOfBirth}
                          onChange={(e) => setDateOfBirth(e.target.value)}
                          className="w-full bg-transparent text-sm text-white focus:outline-none [color-scheme:dark]"
                        />
                      </div>
                    </label>
                    <p className="flex items-center gap-1.5 text-[11px] text-slate-400 px-1">
                      <Info className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                      You must be at least 13 years old to create an account.
                    </p>
                  </div>

                  {/* Password */}
                  <label className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-[#070B22] border border-blue-500/30 focus-within:border-cyan-400 transition-colors">
                    <Lock className="w-5 h-5 text-violet-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="block text-[11px] text-slate-400">Password</span>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Create a strong password"
                        className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-400 hover:text-white"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </label>

                  {/* Consent */}
                  <div className="flex items-start gap-2.5 pt-1">
                    <input
                      id="terms-consent"
                      type="checkbox"
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded accent-violet-500 cursor-pointer"
                    />
                    <label htmlFor="terms-consent" className="text-xs text-slate-300 leading-relaxed">
                      I agree to the{' '}
                      <button
                        type="button"
                        onClick={() => setLegalDoc('terms')}
                        className="text-violet-400 hover:underline font-medium"
                      >
                        Terms of Service
                      </button>{' '}
                      and{' '}
                      <button
                        type="button"
                        onClick={() => setLegalDoc('privacy')}
                        className="text-violet-400 hover:underline font-medium"
                      >
                        Privacy Policy
                      </button>
                      .
                    </label>
                  </div>
                </>
              ) : (
                <>
                  {/* Sign In Identifier */}
                  <label className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#070B22] border border-blue-500/30 focus-within:border-cyan-400 transition-colors">
                    <Mail className="w-5 h-5 text-violet-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="block text-[11px] text-slate-400">Email or username</span>
                      <input
                        type="text"
                        required
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        placeholder="you@example.com or @username"
                        className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
                      />
                    </div>
                  </label>

                  {/* Sign In Password */}
                  <label className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#070B22] border border-blue-500/30 focus-within:border-cyan-400 transition-colors">
                    <Lock className="w-5 h-5 text-violet-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="block text-[11px] text-slate-400">Password</span>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-400 hover:text-white"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </label>
                </>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full min-h-[48px] rounded-full blin-cta-gradient text-white font-display font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-violet-600/25 hover:opacity-95 active:scale-[0.99] transition-all disabled:opacity-50"
              >
                <span>
                  {submitting
                    ? 'Please wait...'
                    : mode === 'register'
                    ? 'Create Account'
                    : 'Sign in'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <p className="text-center text-xs text-slate-400">
              {mode === 'register' ? (
                <>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => setMode('login')}
                    className="text-violet-400 font-semibold hover:underline"
                  >
                    Sign in
                  </button>
                </>
              ) : (
                <>
                  Don&apos;t have an account?{' '}
                  <button
                    type="button"
                    onClick={() => setMode('register')}
                    className="text-violet-400 font-semibold hover:underline"
                  >
                    Create one
                  </button>
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      <LegalModal docType={legalDoc} onClose={() => setLegalDoc(null)} />
    </div>
  );
}
