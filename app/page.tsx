'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import AppSplashScreen from '@/components/AppSplashScreen';

export default function RootPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    // Logged-in user without profile → onboarding
    if (user && !profile) {
      router.replace('/onboarding');
    } else {
      // Everyone (guests & logged-in users) → home
      router.replace('/home');
    }
  }, [user, profile, loading, router]);

  return <AppSplashScreen message="Lendly" subMessage="Find what you need, right around you." />;
}
