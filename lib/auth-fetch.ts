import { supabase } from './supabase';

/**
 * Make an authenticated fetch call to an API route.
 * Automatically attaches the Supabase Auth access token as a Bearer token.
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  if (!token) {
    throw new Error('You must be logged in to perform this action');
  }

  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${token}`);

  // Set Content-Type to JSON if there's a body and no Content-Type set
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(url, {
    ...options,
    headers,
  });
}
