import { NextResponse } from 'next/server';
import { verifyAuth, isNonEmptyString } from '@/lib/verify-auth';
import { isOnlinePaymentEnabled } from '@/lib/supabase-server';
import { isValidCheckoutSignature, recordPaidOrder } from '@/lib/razorpay-server';

/** Called by the checkout handler: verifies the payment and creates the order */
export async function POST(request: Request) {
  try {
    const { uid } = await verifyAuth(request);
    if (!isOnlinePaymentEnabled()) {
      return NextResponse.json({ error: 'Online payments are not set up' }, { status: 503 });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await request.json() as {
      razorpay_order_id?: string;
      razorpay_payment_id?: string;
      razorpay_signature?: string;
    };
    if (!isNonEmptyString(razorpay_order_id) || !isNonEmptyString(razorpay_payment_id) || !isNonEmptyString(razorpay_signature)) {
      return NextResponse.json({ error: 'Missing Razorpay payment details' }, { status: 400 });
    }
    if (!isValidCheckoutSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
      return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 });
    }

    const { orderId } = await recordPaidOrder(razorpay_payment_id, uid);
    return NextResponse.json({ success: true, orderId });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error('Payment verification error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Payment verification failed' }, { status: 400 });
  }
}
