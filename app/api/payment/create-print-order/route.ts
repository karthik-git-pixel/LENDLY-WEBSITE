import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { verifyAuth, isNonEmptyString, MAX_TRANSACTION_AMOUNT } from '@/lib/verify-auth';
import { getRazorpayKeys, getUserSupabase, isOnlinePaymentEnabled } from '@/lib/supabase-server';

/** Starts an online payment for a print job, priced from the shop's own rates */
export async function POST(request: Request) {
  try {
    const { uid, token } = await verifyAuth(request);
    if (!isOnlinePaymentEnabled()) {
      return NextResponse.json({ error: 'Online payments are not set up. Choose pay on delivery.' }, { status: 503 });
    }
    const keys = getRazorpayKeys()!;
    const body = await request.json() as {
      providerId?: string; filePaths?: string[]; fileNames?: string[]; copies?: number; pageCount?: number;
      colorMode?: string; paperSize?: string; orientation?: string; sides?: string;
      specialInstructions?: string; deliveryAddress?: string; phone?: string;
    };
    if (!isNonEmptyString(body.providerId) || !body.filePaths?.length) {
      return NextResponse.json({ error: 'Missing print shop or documents' }, { status: 400 });
    }

    const { data: shop } = await getUserSupabase(token)
      .from('profiles')
      .select('id, is_print_provider, print_price_bw, print_price_color')
      .eq('id', body.providerId)
      .maybeSingle();
    if (!shop?.is_print_provider) return NextResponse.json({ error: 'This print shop is not taking orders' }, { status: 400 });

    const rate = body.colorMode === 'color' ? Number(shop.print_price_color) : Number(shop.print_price_bw);
    const amount = Math.max(1, Math.round(rate * Math.max(1, Number(body.pageCount) || 1) * Math.max(1, Number(body.copies) || 1) * 100) / 100);
    if (amount > MAX_TRANSACTION_AMOUNT) return NextResponse.json({ error: 'Amount too large for online payment' }, { status: 400 });

    const files = JSON.stringify({ paths: body.filePaths, names: body.fileNames || [] });
    if (files.length > 255) {
      return NextResponse.json({ error: 'Too many files for online payment — choose pay on delivery' }, { status: 400 });
    }

    const order = await new Razorpay({ key_id: keys.keyId, key_secret: keys.keySecret }).orders.create({
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: `lendly_print_${Date.now()}`,
      notes: {
        kind: 'print_order',
        buyerId: uid,
        providerId: body.providerId,
        files,
        copies: String(body.copies || 1),
        pageCount: String(body.pageCount || 1),
        colorMode: body.colorMode === 'color' ? 'color' : 'bw',
        paperSize: body.paperSize || 'A4',
        orientation: body.orientation || 'portrait',
        sides: body.sides === 'double' ? 'double' : 'single',
        instructions: (body.specialInstructions || '').slice(0, 200),
        address: (body.deliveryAddress || '').slice(0, 250),
        phone: (body.phone || '').slice(0, 20),
      },
    });
    return NextResponse.json({ id: order.id, amount: order.amount, currency: order.currency, keyId: keys.keyId });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to create payment' }, { status: 500 });
  }
}
