import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export interface AuthResult {
  uid: string;
  email?: string;
  /** The caller's access token, for acting as them via getUserSupabase() */
  token: string;
}

/**
 * Verify the Supabase Auth token from the Authorization header.
 * Returns the authenticated user's UID, email and token.
 * Throws a NextResponse with 401 if the token is missing or invalid.
 */
export async function verifyAuth(request: Request): Promise<AuthResult> {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw NextResponse.json(
      { error: 'Unauthorized: Missing or malformed Authorization header' },
      { status: 401 }
    );
  }

  const token = authHeader.slice(7); // Remove "Bearer " prefix

  if (!token || token.length < 10) {
    throw NextResponse.json(
      { error: 'Unauthorized: Invalid token' },
      { status: 401 }
    );
  }

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    throw NextResponse.json(
      { error: 'Unauthorized: Invalid or expired token' },
      { status: 401 }
    );
  }

  return { uid: user.id, email: user.email || undefined, token };
}

/**
 * Input validation helpers
 */
export function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

/** Maximum single transaction amount in rupees */
export const MAX_TRANSACTION_AMOUNT = 100_000;
