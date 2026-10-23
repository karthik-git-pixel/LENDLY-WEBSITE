import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { verifyAuth, isNonEmptyString, MAX_TRANSACTION_AMOUNT } from '@/lib/verify-auth';
import { getRazorpayKeys, getUserSupabase, isOnlinePaymentEnabled } from '@/lib/supabase-server';

/**
 * Starts an online payment for a purchase or rental. The amount always
 * comes from the database quote, and the booking details ride along in
 * the Razorpay order notes so /verify (or the webhook) can create the order.
 */
export async function POST(request: Request) {
  try {
    const { uid, token } = await verifyAuth(request);
    if (!isOnlinePaymentEnabled()) {
      return NextResponse.json({ error: 'Online payments are not set up. Choose pay at pickup.' }, { status: 503 });
    }
    const keys = getRazorpayKeys()!;

    const { productId, start, end, notes } = await request.json() as {
      productId?: string;
      start?: string | null;
      end?: string | null;
      notes?: string;
    };
    if (!isNonEmptyString(productId)) {
      return NextResponse.json({ error: 'Missing listing' }, { status: 400 });
    }

    const db = getUserSupabase(token);
    const { data: product, error: productError } = await db
      .from('products')
      .select('id, seller_id, title, status')
      .eq('id', productId)
      .maybeSingle();
    if (productError || !product) return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    if (product.seller_id === uid) return NextResponse.json({ error: 'You cannot order your own listing' }, { status: 400 });
    if (product.status !== 'available') return NextResponse.json({ error: 'This listing is not available right now' }, { status: 400 });

    const { data: quote, error: quoteError } = await db.rpc('quote_order', {
      p_product_id: productId,
      p_start: start || null,
      p_end: end || null,
    });
    if (quoteError) return NextResponse.json({ error: quoteError.message }, { status: 400 });

    const amount = Number((quote as { amount: number }).amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'This listing has no price set' }, { status: 400 });
    }
    if (amount > MAX_TRANSACTION_AMOUNT) {
      return NextResponse.json({ error: `Online payments are limited to ₹${MAX_TRANSACTION_AMOUNT.toLocaleString('en-IN')}. Choose pay at pickup.` }, { status: 400 });
    }

    const razorpay = new Razorpay({ key_id: keys.keyId, key_secret: keys.keySecret });
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // paise
      currency: 'INR',
      receipt: `lendly_${productId.slice(0, 8)}_${Date.now()}`,
      notes: {
        kind: 'order',
        buyerId: uid,
        productId,
        start: start || '',
        end: end || '',
        notes: (notes || '').slice(0, 250),
        amount: String(amount),
      },
    });

    return NextResponse.json({ id: order.id, amount: order.amount, currency: order.currency, keyId: keys.keyId });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error('Payment order creation error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to create payment' }, { status: 500 });
  }
}
