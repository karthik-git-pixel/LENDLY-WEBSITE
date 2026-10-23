'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { getErrorMessage } from '@/lib/error-utils';
import toast from 'react-hot-toast';
import { Mail, ArrowLeft, ArrowRight, CheckCircle2, ShieldCheck, RotateCcw } from 'lucide-react';
import Logo from '@/components/Logo';
import AuthBrandPanel from '@/components/AuthBrandPanel';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [resending, setResending] = useState(false);
  const { resetPassword } = useAuth();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return toast.error('Please enter your email address');

    setLoading(true);
    try {
      await resetPassword(email.trim());
      setSubmitted(true);
      toast.success('Password recovery link sent!');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to send recovery email'));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email.trim()) return;
    setResending(true);
    try {
      await resetPassword(email.trim());
      toast.success('Password recovery link resent!');
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
          {/* Back link */}
          <Link
            href="/login"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              fontWeight: 600,
              color: '#64748b',
              textDecoration: 'none',
              marginBottom: 20
            }}
          >
            <ArrowLeft size={16} /> Back to Sign In
          </Link>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 26 }}>
            <Logo size={64} style={{ marginBottom: 8 }} />
            <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.8px', color: 'var(--ink)', marginBottom: 4 }}>
              {submitted ? 'Check Your Email' : 'Reset Password'}
            </h1>
            <p style={{ color: '#5c6b8a', fontSize: 13.5, fontWeight: 500 }}>
              {submitted
                ? `We sent password recovery instructions to ${email}`
                : 'Enter your registered email and we\'ll send you a recovery link.'}
            </p>
          </div>

          {submitted ? (
            /* Success confirmation */
            <div style={{ textAlign: 'center', padding: '10px 0 16px 0' }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%', background: '#ecfdf5',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto',
                color: '#10b981'
              }}>
                <CheckCircle2 size={38} />
              </div>

              <p style={{ fontSize: 14, color: '#334155', lineHeight: 1.6, marginBottom: 24 }}>
                Please check your inbox (and spam folder) for the password reset email. Click the link inside to set a new password.
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
                {resending ? 'Resending...' : 'Resend reset link'}
              </button>

              <Link
                href="/login"
                className="btn-primary"
                style={{
                  width: '100%', padding: '13px 16px', borderRadius: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  fontSize: 14, fontWeight: 700, textDecoration: 'none'
                }}
              >
                Return to Sign In <ArrowRight size={16} />
              </Link>
            </div>
          ) : (
            /* Request Form */
            <form onSubmit={handleReset}>
              <div style={{ marginBottom: 22 }}>
                <label className="input-label" style={{ fontSize: 12.5, fontWeight: 600, color: '#334155', marginBottom: 6, display: 'block' }}>
                  Email Address
                </label>
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
                    enterKeyHint="send"
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
                  <>Send Recovery Link <ArrowRight size={18} /></>
                )}
              </button>

              <div style={{ textAlign: 'center', marginTop: 24 }}>
                <span style={{ fontSize: 13.5, color: '#64748b' }}>Remember your password? </span>
                <Link href="/login" style={{ color: '#f97316', fontWeight: 700, textDecoration: 'none', fontSize: 13.5 }}>
                  Sign In
                </Link>
              </div>
            </form>
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
