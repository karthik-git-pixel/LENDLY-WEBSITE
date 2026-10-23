import { NextResponse } from 'next/server';
import { isOnlinePaymentEnabled } from '@/lib/supabase-server';

/** Tells the client whether "pay online" can be offered alongside pay-at-pickup */
export async function GET() {
  return NextResponse.json({ online: isOnlinePaymentEnabled() });
}
