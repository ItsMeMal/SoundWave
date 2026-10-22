import React, { useState } from 'react';
import { X, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';

export const AuthModal: React.FC = () => {
  const { 
    authModalOpen, 
    authModalTab, 
    closeAuthModal, 
    openAuthModal, 
    loginWithEmail, 
    registerWithEmail, 
    loginWithGoogle, 
    resetPassword 
  } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!authModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setSubmitting(true);

    try {
      if (authModalTab === 'login') {
        if (!email.trim() || !password) {
          throw new Error('Please fill in both email and password.');
        }
        await loginWithEmail(email.trim(), password);
      } else if (authModalTab === 'register') {
        if (!name.trim() || !email.trim() || !password) {
          throw new Error('Please fill in name, email, and password.');
        }
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters.');
        }
        await registerWithEmail(name.trim(), email.trim(), password);
      } else if (authModalTab === 'forgot') {
        if (!email.trim()) {
          throw new Error('Please enter your email address.');
        }
        await resetPassword(email.trim());
        setSuccessMsg('Password reset instructions have been sent to your email.');
      }
    } catch (err: any) {
      console.warn('Auth notice:', err.message);
      let msg = err.message || 'An error occurred during authentication.';
      if (msg.includes('auth/invalid-credential') || msg.includes('auth/wrong-password')) {
        msg = 'Invalid email or password.';
      } else if (msg.includes('auth/email-already-in-use')) {
        msg = 'An account with this email already exists.';
      } else if (msg.includes('auth/invalid-email')) {
        msg = 'Invalid email format.';
      } else if (msg.includes('auth/weak-password')) {
        msg = 'Password is too weak. Please use at least 6 characters.';
      }
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setSubmitting(true);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to sign in with Google.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-[#131720] border border-[#222838] rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[540px]">
        <button
          onClick={closeAuthModal}
          className="absolute top-4 right-4 z-10 p-2 text-zinc-400 hover:text-white rounded-full bg-black/40 hover:bg-black/70 transition-colors"
          aria-label="Close Modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Left Visual Artwork Panel */}
        <div className="hidden md:block md:w-5/12 relative overflow-hidden bg-zinc-950">
          <img
            src="https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&q=80"
            alt="SoundWave visual"
            className="w-full h-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#131720] via-transparent to-black/30" />
          <div className="absolute bottom-8 left-8 right-8">
            <div className="flex items-end gap-1.5 h-6 mb-3">
              <span className="w-1.5 h-4 bg-emerald-400 rounded-full" />
              <span className="w-1.5 h-7 bg-emerald-400 rounded-full" />
              <span className="w-1.5 h-5 bg-emerald-400 rounded-full" />
            </div>
            <h3 className="text-xl font-bold text-white font-['Plus_Jakarta_Sans']">
              SoundWave
            </h3>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              Experience sound reimagined. Unlimited streaming, high fidelity audio, and verified lyrics.
            </p>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="w-full md:w-7/12 p-8 md:p-10 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-end gap-1 h-5">
              <span className="w-1 h-3 bg-emerald-400 rounded-full" />
              <span className="w-1 h-5 bg-emerald-400 rounded-full" />
              <span className="w-1 h-3.5 bg-emerald-400 rounded-full" />
            </div>
            <span className="text-lg font-bold text-white">SoundWave</span>
          </div>

          <h2 className="text-2xl font-extrabold text-white tracking-tight">
            {authModalTab === 'login' && 'Listen to what you love'}
            {authModalTab === 'register' && 'Create your account'}
            {authModalTab === 'forgot' && 'Reset your password'}
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            {authModalTab === 'login' && 'Welcome back! Log in to continue your session.'}
            {authModalTab === 'register' && 'Join and start listening to your favorite music.'}
            {authModalTab === 'forgot' && 'Enter your email and we will send you a password reset link.'}
          </p>

          {errorMsg && (
            <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400">
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-400">
              {successMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
            {authModalTab === 'register' && (
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Full name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#1b202c] border border-zinc-700/60 text-white text-sm focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/40"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                {authModalTab === 'login' ? 'Email or username' : 'Email'}
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#1b202c] border border-zinc-700/60 text-white text-sm focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/40"
              />
            </div>

            {authModalTab !== 'forgot' && (
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={authModalTab === 'register' ? 'Create a password (min 6 chars)' : 'Enter your password'}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#1b202c] border border-zinc-700/60 text-white text-sm focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/40 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {authModalTab === 'login' && (
              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 text-zinc-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-zinc-700 bg-zinc-800 text-emerald-500 focus:ring-0"
                  />
                  <span>Remember me</span>
                </label>
                <button
                  type="button"
                  onClick={() => openAuthModal('forgot')}
                  className="text-emerald-400 hover:underline"
                >
                  Forgot password?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-black font-bold text-sm transition-all shadow-md active:scale-[0.99] flex items-center justify-center gap-2 mt-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>
                {authModalTab === 'login' && 'Login'}
                {authModalTab === 'register' && 'Register'}
                {authModalTab === 'forgot' && 'Send Reset Link'}
              </span>
            </button>
          </form>

          {authModalTab !== 'forgot' && (
            <>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-zinc-800" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-3 bg-[#131720] text-zinc-500">
                    or continue with
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={submitting}
                className="w-full py-2.5 rounded-xl bg-white hover:bg-zinc-100 text-black font-semibold text-sm transition-all shadow flex items-center justify-center gap-3 active:scale-[0.99]"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.15z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>
            </>
          )}

          <div className="mt-5 text-center text-xs text-zinc-400">
            {authModalTab === 'login' && (
              <p>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => openAuthModal('register')}
                  className="text-emerald-400 font-semibold hover:underline ml-1"
                >
                  Register
                </button>
              </p>
            )}

            {authModalTab === 'register' && (
              <p>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => openAuthModal('login')}
                  className="text-emerald-400 font-semibold hover:underline ml-1"
                >
                  Login
                </button>
              </p>
            )}

            {authModalTab === 'forgot' && (
              <p>
                Remember your password?{' '}
                <button
                  type="button"
                  onClick={() => openAuthModal('login')}
                  className="text-emerald-400 font-semibold hover:underline ml-1"
                >
                  Back to login
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
