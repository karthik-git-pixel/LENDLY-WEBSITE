'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getErrorMessage } from '@/lib/error-utils';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Lock, Eye, EyeOff, ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';
import Logo from '@/components/Logo';
import AuthBrandPanel from '@/components/AuthBrandPanel';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const { updatePassword } = useAuth();
  const router = useRouter();

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !confirmPassword) {
      return toast.error('Please enter and confirm your new password');
    }
    if (password.length < 6) {
      return toast.error('Password must be at least 6 characters');
    }
    if (password !== confirmPassword) {
      return toast.error('Passwords do not match');
    }

    setLoading(true);
    try {
      await updatePassword(password);
      setSuccess(true);
      toast.success('Password updated successfully!');
      setTimeout(() => {
        router.replace('/home');
      }, 2000);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update password. Recovery link may have expired.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lp-auth">
      <AuthBrandPanel />

      <main className="lp-auth-main">
        <div className="lp-auth-card slide-up">
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 26 }}>
            <Logo size={64} style={{ marginBottom: 8 }} />
            <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.8px', color: 'var(--ink)', marginBottom: 4 }}>
              {success ? 'Password Updated!' : 'Set New Password'}
            </h1>
            <p style={{ color: '#5c6b8a', fontSize: 13.5, fontWeight: 500 }}>
              {success
                ? 'Your password has been changed. Redirecting to Lendly...'
                : 'Create a new, secure password for your account.'}
            </p>
          </div>

          {success ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%', background: '#ecfdf5',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto',
                color: '#10b981'
              }}>
                <CheckCircle2 size={38} />
              </div>

              <p style={{ fontSize: 14, color: '#334155', lineHeight: 1.6, marginBottom: 24 }}>
                You can now use your new password to sign in across all your devices.
              </p>

              <Link
                href="/home"
                className="btn-primary"
                style={{
                  width: '100%', padding: '13px 16px', borderRadius: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  fontSize: 14, fontWeight: 700, textDecoration: 'none'
                }}
              >
                Go to Home <ArrowRight size={16} />
              </Link>
            </div>
          ) : (
            <form onSubmit={handleUpdate}>
              <div style={{ marginBottom: 16 }}>
                <label className="input-label" style={{ fontSize: 12.5, fontWeight: 600, color: '#334155', marginBottom: 6, display: 'block' }}>
                  New Password
                </label>
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
                <label className="input-label" style={{ fontSize: 12.5, fontWeight: 600, color: '#334155', marginBottom: 6, display: 'block' }}>
                  Confirm New Password
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type={showPass ? 'text' : 'password'}
                    className="input-field"
                    style={{ paddingLeft: 42, height: 48, borderRadius: 14, fontSize: 14 }}
                    placeholder="Re-enter your new password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
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
                  boxShadow: '0 4px 14px rgba(22, 163, 74, 0.3)'
                }}
                disabled={loading}
              >
                {loading ? (
                  <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
                ) : (
                  <>Update Password <ArrowRight size={18} /></>
                )}
              </button>
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
