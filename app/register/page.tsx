'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getErrorMessage } from '@/lib/error-utils';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Mail, Lock, Eye, EyeOff, ArrowRight, ShieldCheck, User, CheckCircle2, RotateCcw } from 'lucide-react';
import Logo from '@/components/Logo';
import AuthBrandPanel from '@/components/AuthBrandPanel';

export default function RegisterPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [resending, setResending] = useState(false);

  const { signUp, signInWithGoogle, resendVerificationEmail } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '';

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email || !password || !confirmPass) {
      return toast.error('Please fill all fields');
    }
    if (password.length < 6) return toast.error('Password must be at least 6 characters');
    if (password !== confirmPass) return toast.error('Passwords do not match');

    setLoading(true);
    try {
      const { needsEmailConfirmation } = await signUp(email, password, fullName.trim());
      if (needsEmailConfirmation) {
        setEmailSent(true);
        toast.success('Account created! Please verify your email.');
      } else {
        toast.success('Account created! Let\'s set up your profile.');
        router.push('/onboarding');
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Registration failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      await signInWithGoogle(redirectTo || '/onboarding');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Google sign-in failed'));
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) return;
    setResending(true);
    try {
      await resendVerificationEmail(email);
      toast.success('Verification link resent!');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not resend email'));
    } finally {
      setResending(false);
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
            {emailSent ? 'Check Your Inbox' : 'Create Account'}
          </h1>
          <p style={{ color: '#5c6b8a', fontSize: 13.5, fontWeight: 500 }}>
            {emailSent 
              ? `We sent a confirmation link to ${email}`
              : 'Join Lendly and start trading with neighbours.'}
          </p>
        </div>

        {emailSent ? (
          /* Email Confirmation Sent State */
          <div style={{ textAlign: 'center', padding: '10px 0 16px 0' }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%', background: '#ecfdf5',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto',
              color: '#10b981'
            }}>
              <CheckCircle2 size={38} />
            </div>

            <p style={{ fontSize: 14, color: '#334155', lineHeight: 1.6, marginBottom: 24 }}>
              Click the link in the email to activate your account and access local borrowing, renting, and trading.
            </p>

            <button
              onClick={handleResend}
              disabled={resending}
              className="btn-secondary"
              style={{
                width: '100%', padding: '13px 16px', borderRadius: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                fontSize: 14, fontWeight: 600, color: '#0b2240', marginBottom: 12
              }}
            >
              <RotateCcw size={16} />
              {resending ? 'Resending link...' : 'Resend confirmation link'}
            </button>

            <Link
              href={`/login${redirectTo ? `?redirect=${encodeURIComponent(redirectTo)}` : ''}`}
              className="btn-primary"
              style={{
                width: '100%', padding: '13px 16px', borderRadius: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                fontSize: 14, fontWeight: 700, textDecoration: 'none'
              }}
            >
              Go to Sign In <ArrowRight size={16} />
            </Link>
          </div>
        ) : (
          /* Normal Registration Form */
          <>
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
              Sign Up with Google
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
              <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
              <span style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, letterSpacing: '0.5px' }}>OR REGISTER WITH EMAIL</span>
              <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
            </div>

            <form onSubmit={handleRegister}>
              <div style={{ marginBottom: 16 }}>
                <label className="input-label" style={{ fontSize: 12.5, fontWeight: 600, color: '#334155', marginBottom: 6, display: 'block' }}>Full Name</label>
                <div style={{ position: 'relative' }}>
                  <User size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type="text"
                    className="input-field"
                    style={{ paddingLeft: 42, height: 48, borderRadius: 14, fontSize: 14 }}
                    placeholder="e.g. Rahul Sharma"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    autoComplete="name"
                    required
                  />
                </div>
              </div>

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

              <div style={{ marginBottom: 16 }}>
                <label className="input-label" style={{ fontSize: 12.5, fontWeight: 600, color: '#334155', marginBottom: 6, display: 'block' }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type={showPass ? 'text' : 'password'}
                    className="input-field"
                    style={{ paddingLeft: 42, paddingRight: 42, height: 48, borderRadius: 14, fontSize: 14 }}
                    placeholder="Minimum 6 characters"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete="new-password"
                    enterKeyHint="next"
                    minLength={6}
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

              <div style={{ marginBottom: 22 }}>
                <label className="input-label" style={{ fontSize: 12.5, fontWeight: 600, color: '#334155', marginBottom: 6, display: 'block' }}>Confirm Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type={showPass ? 'text' : 'password'}
                    className="input-field"
                    style={{ paddingLeft: 42, height: 48, borderRadius: 14, fontSize: 14 }}
                    placeholder="Re-enter your password"
                    value={confirmPass}
                    onChange={e => setConfirmPass(e.target.value)}
                    autoComplete="new-password"
                    enterKeyHint="go"
                    minLength={6}
                    required
                  />
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
                  <>Get Started <ArrowRight size={18} /></>
                )}
              </button>
            </form>

            <p style={{ textAlign: 'center', marginTop: 24, fontSize: 13.5, color: '#64748b', fontWeight: 500 }}>
              Already have an account?{' '}
              <Link href={`/login${redirectTo ? `?redirect=${encodeURIComponent(redirectTo)}` : ''}`} style={{ color: '#f97316', textDecoration: 'none', fontWeight: 700 }}>
                Sign In
              </Link>
            </p>
          </>
        )}

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

