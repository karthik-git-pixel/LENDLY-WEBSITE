import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { supabaseAnonKey, supabaseUrl } from './supabase';

/**
 * A client that acts as the signed-in user, so row-level security and the
 * auth.uid() checks inside the database functions apply to API routes too.
 */
export function getUserSupabase(accessToken: string): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const isServiceRoleConfigured = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

/**
 * Elevated client for writes no user may make on their own behalf
 * (recording a verified Razorpay payment, refunds). Server-only.
 */
export function getServiceSupabase(): SupabaseClient {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey || !supabaseUrl) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL in environment');
  }
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Razorpay is optional: without keys, orders are paid at pickup */
export function getRazorpayKeys(): { keyId: string; keySecret: string } | null {
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.replace(/^"|"$/g, '');
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.replace(/^"|"$/g, '');
  return keyId && keySecret ? { keyId, keySecret } : null;
}

/** Online checkout needs both Razorpay and the service role to record payments */
export function isOnlinePaymentEnabled(): boolean {
  return Boolean(getRazorpayKeys()) && isServiceRoleConfigured;
}
