'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { getMyProfile, toggleSavedProduct, type UserProfile } from './firestore';

export interface AppUser {
  id: string;
  uid: string;
  email: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  user_metadata?: Record<string, unknown>;
}

export interface SignUpResult {
  user: AppUser | null;
  needsEmailConfirmation: boolean;
}

interface AuthContextType {
  user: AppUser | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AppUser>;
  signUp: (email: string, password: string, fullName?: string) => Promise<SignUpResult>;
  signInWithGoogle: (redirectPath?: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  resendVerificationEmail: (email: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  toggleSaved: (productId: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

function normalizeUser(sbUser: User | null | undefined): AppUser | null {
  if (!sbUser) return null;
  return {
    id: sbUser.id,
    uid: sbUser.id,
    email: sbUser.email || null,
    displayName:
      sbUser.user_metadata?.full_name ||
      sbUser.user_metadata?.name ||
      sbUser.user_metadata?.display_name ||
      sbUser.email?.split('@')[0] ||
      '',
    photoURL:
      sbUser.user_metadata?.avatar_url ||
      sbUser.user_metadata?.picture ||
      '',
    user_metadata: sbUser.user_metadata || {},
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (_uid: string) => {
    try {
      const p = await getMyProfile();
      setProfile(p);
      return p;
    } catch (err) {
      console.warn('Could not fetch user profile:', err);
      return null;
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    // The user only appears once their profile has loaded. Otherwise pages
    // briefly see "signed in, no profile" and bounce to onboarding.

    // 1. Initial session check
    supabase.auth
      .getSession()
      .then(async ({ data: { session } }) => {
        if (!isMounted) return;
        const appUser = normalizeUser(session?.user);
        if (appUser) await fetchProfile(appUser.id);
        if (!isMounted) return;
        setUser(appUser);
        setLoading(false);
      })
      .catch(() => {
        if (isMounted) setLoading(false);
      });

    // 2. Auth state changes listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
      const appUser = normalizeUser(session?.user);
      if (appUser) {
        await fetchProfile(appUser.id);
      } else {
        setProfile(null);
      }
      if (!isMounted) return;
      setUser(appUser);
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signIn = async (email: string, password: string): Promise<AppUser> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const appUser = normalizeUser(data.user)!;
    setUser(appUser);
    if (appUser) {
      await fetchProfile(appUser.id);
    }
    return appUser;
  };

  const signUp = async (email: string, password: string, fullName?: string): Promise<SignUpResult> => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: fullName ? { full_name: fullName, name: fullName } : undefined,
        emailRedirectTo: `${origin}/auth/callback`,
      },
    });
    if (error) throw error;

    const needsEmailConfirmation = !data.session && !!data.user && !data.user.confirmed_at;
    const appUser = normalizeUser(data.user);
    if (appUser && data.session) {
      setUser(appUser);
      await fetchProfile(appUser.id);
    }

    return { user: appUser, needsEmailConfirmation };
  };

  const signInWithGoogle = async (redirectPath: string = '/home'): Promise<void> => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const redirectUrl = `${origin}/auth/callback?redirect=${encodeURIComponent(redirectPath)}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
    if (error) throw error;
  };

  const signOut = async (): Promise<void> => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const resetPassword = async (email: string): Promise<void> => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const redirectUrl = `${origin}/auth/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });
    if (error) throw error;
  };

  const updatePassword = async (newPassword: string): Promise<void> => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) throw error;
  };

  const resendVerificationEmail = async (email: string): Promise<void> => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
      },
    });
    if (error) throw error;
  };

  const refreshProfile = async (): Promise<void> => {
    if (user) await fetchProfile(user.id);
  };

  const toggleSaved = async (productId: string): Promise<boolean> => {
    if (!user || !profile) return false;
    const current = profile.savedProducts || [];
    const isAlreadySaved = current.includes(productId);
    const updated = isAlreadySaved
      ? current.filter(id => id !== productId)
      : [...current, productId];

    // Optimistic local update
    setProfile(prev => prev ? { ...prev, savedProducts: updated } : null);

    try {
      await toggleSavedProduct(user.id, productId, current);
      return !isAlreadySaved;
    } catch (err) {
      console.error('Failed to sync saved product:', err);
      setProfile(prev => prev ? { ...prev, savedProducts: current } : null);
      throw err;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
        resetPassword,
        updatePassword,
        resendVerificationEmail,
        refreshProfile,
        toggleSaved,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

