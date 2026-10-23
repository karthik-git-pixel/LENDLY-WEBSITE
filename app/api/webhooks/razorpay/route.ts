import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { isOnlinePaymentEnabled } from '@/lib/supabase-server';
import { recordPaidOrder } from '@/lib/razorpay-server';

/**
 * Backstop for payments whose browser tab closed before /verify ran:
 * a captured payment still becomes an order (recordPaidOrder is idempotent).
 */
export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-razorpay-signature');
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;

    if (!webhookSecret) {
      return NextResponse.json({ error: 'Webhook secret is not configured' }, { status: 500 });
    }
    if (!signature) {
      return NextResponse.json({ error: 'Missing Razorpay signature header' }, { status: 400 });
    }

    const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 });
    }

    const payload = JSON.parse(rawBody);
    if (payload.event === 'payment.captured' && isOnlinePaymentEnabled()) {
      const paymentId = payload.payload?.payment?.entity?.id as string | undefined;
      if (paymentId) {
        try {
          await recordPaidOrder(paymentId);
        } catch (err) {
          // Already refunded inside recordPaidOrder when the order couldn't be made
          console.warn('Webhook could not record payment', paymentId, err);
        }
      }
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Razorpay webhook error:', error);
    return NextResponse.json({ error: 'Webhook handler error' }, { status: 500 });
  }
}
