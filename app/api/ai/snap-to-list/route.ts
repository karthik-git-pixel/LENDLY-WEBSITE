import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/verify-auth';
import { snapConfigured, snapToList } from '@/lib/ai/snapToList';
import { SNAP_MAX_BYTES, type SnapResponse } from '@/lib/ai/snap-types';

// Calls per user per hour. Kept in memory, so it is per server instance — enough
// to stop a runaway client, not a billing guarantee.
const HOURLY_LIMIT = 10;
const HOUR = 60 * 60 * 1000;
const calls = new Map<string, number[]>();

function overLimit(uid: string): boolean {
  const now = Date.now();
  const recent = (calls.get(uid) || []).filter(t => now - t < HOUR);
  if (recent.length >= HOURLY_LIMIT) {
    calls.set(uid, recent);
    return true;
  }
  calls.set(uid, [...recent, now]);
  return false;
}

const fallback = (error: string, status = 200) => NextResponse.json<SnapResponse>({ fallback: true, error }, { status });

export async function POST(request: Request) {
  let uid: string;
  try {
    ({ uid } = await verifyAuth(request));
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return fallback('Please log in again', 401);
  }

  const form = await request.formData().catch(() => null);
  const image = form?.get('image');
  if (!(image instanceof File)) return fallback('Send one photo', 400);
  if (!image.type.startsWith('image/')) return fallback('That file isn’t a photo', 400);
  if (image.size > SNAP_MAX_BYTES) return fallback('Photo is larger than 8 MB', 400);

  if (!snapConfigured()) return fallback('Snap to List isn’t set up yet');
  if (overLimit(uid)) return fallback('You’ve used Snap to List 10 times this hour — fill this one in manually', 429);

  try {
    const base64 = Buffer.from(await image.arrayBuffer()).toString('base64');
    const result = await snapToList({ base64, mimeType: image.type });
    return NextResponse.json<SnapResponse>({ fallback: false, result });
  } catch (error) {
    console.error('[snap-to-list] failed:', error instanceof Error ? error.message : error);
    return fallback('Couldn’t read the photo');
  }
}
