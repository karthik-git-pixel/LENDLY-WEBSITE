'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getMyProfile } from '@/lib/firestore';
import Logo from '@/components/Logo';
import toast from 'react-hot-toast';

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [statusMessage, setStatusMessage] = useState('Completing authentication...');

  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    let handled = false;

    const safeRedirect = (url: string) => {
      if (handled) return;
      handled = true;
      if (timeoutId) clearTimeout(timeoutId);
      router.replace(url);
    };

    const completeAuth = async () => {
      // 1. Check for error parameters from OAuth provider (query or hash)
      const hash = typeof window !== 'undefined' ? window.location.hash : '';
      const hashParams = hash ? new URLSearchParams(hash.replace(/^#/, '')) : null;
      const error = searchParams.get('error') || hashParams?.get('error');
      const errorDescription = searchParams.get('error_description') || hashParams?.get('error_description');

      if (error) {
        toast.error(errorDescription || 'Authentication failed');
        safeRedirect('/login');
        return;
      }

      const redirectTo = searchParams.get('redirect') || '/home';

      try {
        const code = searchParams.get('code');
        let currentSession = null;

        if (code) {
          try {
            const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
            if (!exchangeError && data?.session) {
              currentSession = data.session;
            }
          } catch {
            // Handled or already in-flight by detectSessionInUrl
          }
        }

        if (!currentSession) {
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          if (sessionError) throw sessionError;
          currentSession = session;
        }

        if (currentSession?.user) {
          setStatusMessage('Checking your Lendly account...');
          const profile = await getMyProfile();

          if (profile && profile.displayName && profile.phone) {
            toast.success(`Welcome back, ${profile.displayName.split(' ')[0]}!`);
            safeRedirect(redirectTo);
          } else {
            toast.success('Welcome to Lendly! Let\'s set up your profile.');
            safeRedirect('/onboarding');
          }
          return;
        }

        // 3. Fallback listener for auth state transition
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (session?.user && !handled) {
            subscription.unsubscribe();
            if (timeoutId) clearTimeout(timeoutId);
            setStatusMessage('Setting up your profile...');
            try {
              const profile = await getMyProfile();
              if (profile && profile.displayName && profile.phone) {
                toast.success(`Welcome back, ${profile.displayName.split(' ')[0]}!`);
                safeRedirect(redirectTo);
              } else {
                toast.success('Welcome to Lendly! Let\'s set up your profile.');
                safeRedirect('/onboarding');
              }
            } catch (err) {
              safeRedirect('/onboarding');
            }
          }
        });

        // 4. Set a 7-second fallback in case nothing triggers
        timeoutId = setTimeout(() => {
          subscription.unsubscribe();
          if (!handled) {
            toast.error('Authentication session timed out. Please try again.');
            safeRedirect('/login');
          }
        }, 7000);

      } catch (err: any) {
        console.error('Auth callback error:', err);
        toast.error(err.message || 'Authentication error');
        safeRedirect('/login');
      }
    };

    completeAuth();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [router, searchParams]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #f8fafc 0%, #edf2f7 100%)',
      padding: 24,
      textAlign: 'center'
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: 24,
        padding: '40px 32px',
        maxWidth: 420,
        width: '100%',
        boxShadow: '0 20px 40px -15px rgba(11, 34, 64, 0.1)',
        border: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 20
      }}>
        <div style={{ position: 'relative' }}>
          <Logo size={72} />
          <div style={{
            position: 'absolute',
            inset: -8,
            borderRadius: '50%',
            border: '2px dashed #16a34a',
            animation: 'spin 6s linear infinite',
            pointerEvents: 'none',
            opacity: 0.6
          }} />
        </div>

        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0b2240', marginBottom: 6 }}>
            Signing In
          </h2>
          <p style={{ fontSize: 14, color: '#64748b', margin: 0, fontWeight: 500 }}>
            {statusMessage}
          </p>
        </div>

        <div className="spinner" style={{ width: 28, height: 28, borderWidth: 3, borderColor: '#16a34a', borderTopColor: 'transparent' }} />
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    }>
      <CallbackHandler />
    </Suspense>
  );
}
