import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/verify-auth';
import { snapConfigured, snapToList, type DraftInput } from '@/lib/ai/snapToList';
import { SNAP_MAX_BYTES, type SnapResponse } from '@/lib/ai/snap-types';

// Calls per user per hour. Kept in memory, so it is per server instance — enough
// to stop a runaway client, not a billing guarantee.
const HOURLY_LIMIT = 30;
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

  // A photo comes as multipart form data; a model name as JSON { model }
  let input: DraftInput;
  if ((request.headers.get('content-type') || '').includes('application/json')) {
    const body = await request.json().catch(() => null) as { model?: unknown } | null;
    const model = typeof body?.model === 'string' ? body.model.trim().slice(0, 100) : '';
    if (model.length < 2) return fallback('Type the brand and model', 400);
    input = { model };
  } else {
    const form = await request.formData().catch(() => null);
    const image = form?.get('image');
    if (!(image instanceof File)) return fallback('Send one photo', 400);
    if (!image.type.startsWith('image/')) return fallback('That file isn’t a photo', 400);
    if (image.size > SNAP_MAX_BYTES) return fallback('Photo is larger than 8 MB', 400);
    input = { image: { base64: Buffer.from(await image.arrayBuffer()).toString('base64'), mimeType: image.type } };
  }

  if (!snapConfigured()) return fallback('AI auto-fill isn’t set up yet');
  if (overLimit(uid)) return fallback(`You’ve used AI auto-fill ${HOURLY_LIMIT} times this hour — fill this one in manually`, 429);

  try {
    const result = await snapToList(input);
    return NextResponse.json<SnapResponse>({ fallback: false, result });
  } catch (error) {
    console.error('[snap-to-list] failed:', error instanceof Error ? error.message : error);
    return fallback('AI couldn’t fill this in — try again');
  }
}
