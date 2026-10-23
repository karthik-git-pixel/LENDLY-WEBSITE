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
    let timeoutId: NodeJS.Timeout;

    const completeAuth = async () => {
      // 1. Check for error parameters from OAuth provider
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      if (error) {
        toast.error(errorDescription || 'Authentication failed');
        router.replace('/login');
        return;
      }

      const redirectTo = searchParams.get('redirect') || '/home';

      try {
        // 2. Retrieve session (Supabase client auto-parses token from URL hash or exchange code)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (session?.user) {
          setStatusMessage('Checking your Lendly account...');
          const profile = await getMyProfile();

          if (profile && profile.displayName && profile.phone) {
            toast.success(`Welcome back, ${profile.displayName.split(' ')[0]}!`);
            router.replace(redirectTo);
          } else {
            toast.success('Welcome to Lendly! Let\'s set up your profile.');
            router.replace('/onboarding');
          }
          return;
        }

        // 3. Fallback listener for auth state transition
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (session?.user) {
            subscription.unsubscribe();
            setStatusMessage('Setting up your profile...');
            const profile = await getMyProfile();
            if (profile && profile.displayName && profile.phone) {
              router.replace(redirectTo);
            } else {
              router.replace('/onboarding');
            }
          }
        });

        // 4. Set a 6-second fallback in case nothing triggers
        timeoutId = setTimeout(() => {
          subscription.unsubscribe();
          router.replace('/login');
        }, 6000);

      } catch (err: any) {
        console.error('Auth callback error:', err);
        toast.error(err.message || 'Authentication error');
        router.replace('/login');
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
