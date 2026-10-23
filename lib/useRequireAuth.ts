'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import toast from 'react-hot-toast';

/**
 * Hook that provides an auth-gating function.
 * When called, if the user is not logged in, it redirects to /login with a redirect param.
 * If the user is logged in, it executes the provided callback.
 */
export function useRequireAuth() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  /**
   * Gates an action behind authentication.
   * @param callback - The function to execute if user is authenticated
   * @param message - Optional custom toast message (default: "Please log in to continue")
   */
  const requireAuth = (callback?: () => void, message?: string) => {
    if (!user || !profile) {
      toast(message || 'Please log in to continue', {
        icon: '🔒',
        style: {
          background: 'var(--surface)',
          color: 'var(--foreground)',
          border: '1px solid var(--border-color)',
        },
      });
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
      return false;
    }
    if (callback) callback();
    return true;
  };

  const isAuthenticated = !!user && !!profile;

  return { requireAuth, isAuthenticated, user, profile };
}
