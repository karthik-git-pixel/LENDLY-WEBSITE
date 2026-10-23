'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getUserProfile } from '@/lib/firestore';
import { getErrorMessage } from '@/lib/error-utils';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Mail, Lock, Eye, EyeOff, ArrowRight, ShieldCheck, ArrowLeft } from 'lucide-react';
import Logo from '@/components/Logo';
import AuthBrandPanel from '@/components/AuthBrandPanel';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn, signInWithGoogle } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/home';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return toast.error('Please fill all fields');
    setLoading(true);
    try {
      const loggedUser = await signIn(email, password);
      if (loggedUser) {
        const profile = await getUserProfile(loggedUser.id);
        if (profile && profile.displayName && profile.phone) {
          toast.success(`Welcome back, ${profile.displayName.split(' ')[0]}!`);
          router.push(redirectTo);
        } else {
          router.push('/onboarding');
        }
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Login failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      await signInWithGoogle(redirectTo);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Google sign-in failed'));
      setLoading(false);
    }
  };

  return (
    <div className="lp-auth">
      <AuthBrandPanel />

      <main className="lp-auth-main">
        <div className="lp-auth-card slide-up">
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: 26 }}>
          <Logo size={64} style={{ marginBottom: 8 }} />
          <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.8px', color: 'var(--ink)', marginBottom: 4 }}>
            Welcome Back
          </h1>
          <p style={{ color: '#5c6b8a', fontSize: 13.5, fontWeight: 500 }}>
            Sign in to find what you need, right around you.
          </p>
        </div>

        {/* Social Login Button */}
        <button
          onClick={handleGoogle}
          className="btn-secondary"
          style={{
            width: '100%', padding: '13px 16px', borderRadius: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            fontSize: 14, fontWeight: 600, color: '#0b2240',
            background: '#ffffff', border: '1px solid #e2e8f0',
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
            transition: 'all 0.2s ease',
            cursor: 'pointer'
          }}
          disabled={loading}
        >
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.2C12.6 13.2 17.8 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.6 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7.1-10.1 7.1-17.6z"/>
            <path fill="#34A853" d="M10.6 28.5c-1-3-1-6.3 0-9.3l-7.9-6.2C.9 17 0 20.4 0 24s.9 7 2.7 10.9l7.9-6.4z"/>
            <path fill="#FBBC05" d="M24 48c6.5 0 12-2.1 16-5.8l-7.6-5.9c-2.2 1.5-5 2.3-8.4 2.3-6.2 0-11.4-3.7-13.4-9l-7.9 6.4C6.6 42.6 14.6 48 24 48z"/>
          </svg>
          Continue with Google
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
          <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
          <span style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, letterSpacing: '0.5px' }}>OR VIA EMAIL</span>
          <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 16 }}>
            <label className="input-label" style={{ fontSize: 12.5, fontWeight: 600, color: '#334155', marginBottom: 6, display: 'block' }}>Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="email"
                className="input-field"
                style={{ paddingLeft: 42, height: 48, borderRadius: 14, fontSize: 14 }}
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint="next"
                required
              />
            </div>
          </div>

          <div style={{ marginBottom: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label className="input-label" style={{ fontSize: 12.5, fontWeight: 600, color: '#334155', margin: 0, display: 'block' }}>Password</label>
              <Link 
                href={`/forgot-password${redirectTo !== '/home' ? `?redirect=${encodeURIComponent(redirectTo)}` : ''}`} 
                style={{ fontSize: 12, fontWeight: 600, color: '#f97316', textDecoration: 'none' }}
              >
                Forgot password?
              </Link>
            </div>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type={showPass ? 'text' : 'password'}
                className="input-field"
                style={{ paddingLeft: 42, paddingRight: 42, height: 48, borderRadius: 14, fontSize: 14 }}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                enterKeyHint="go"
                required
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                aria-label={showPass ? 'Hide password' : 'Show password'}
                aria-pressed={showPass}
                style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4 }}
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary"
            style={{
              width: '100%', padding: '14px 18px', fontSize: 15, fontWeight: 700, borderRadius: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: '0 4px 14px rgba(249, 115, 22, 0.3)'
            }}
            disabled={loading}
          >
            {loading ? (
              <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
            ) : (
              <>Sign In <ArrowRight size={18} /></>
            )}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 13.5, color: '#64748b', fontWeight: 500 }}>
          Don&apos;t have an account?{' '}
          <Link href={`/register${redirectTo !== '/home' ? `?redirect=${encodeURIComponent(redirectTo)}` : ''}`} style={{ color: '#f97316', textDecoration: 'none', fontWeight: 700 }}>
            Create Account
          </Link>
        </p>

        <div style={{
          marginTop: 20, paddingTop: 16, borderTop: '1px solid #f1f5f9',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          fontSize: 12, color: '#94a3b8'
        }}>
          <ShieldCheck size={14} style={{ color: '#10b981' }} />
          <span>Protected by Lendly Security</span>
        </div>
        </div>
      </main>
    </div>
  );
}
