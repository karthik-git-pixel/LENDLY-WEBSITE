import { NextResponse } from 'next/server';
import { verifyAuth, isNonEmptyString } from '@/lib/verify-auth';
import { getServiceSupabase, getUserSupabase, isOnlinePaymentEnabled } from '@/lib/supabase-server';
import { razorpayClient } from '@/lib/razorpay-server';

/**
 * Refunds an online payment once its order was cancelled or declined
 * (the database marks those "refund_pending"). Either party may trigger it.
 */
export async function POST(request: Request) {
  try {
    const { token } = await verifyAuth(request);
    if (!isOnlinePaymentEnabled()) {
      return NextResponse.json({ error: 'Online payments are not set up' }, { status: 503 });
    }
    const { orderId, kind = 'order' } = await request.json() as { orderId?: string; kind?: 'order' | 'print_order' };
    if (!isNonEmptyString(orderId)) return NextResponse.json({ error: 'Missing order' }, { status: 400 });

    const table = kind === 'print_order' ? 'print_orders' : 'orders';
    const amountColumn = kind === 'print_order' ? 'total_amount' : 'amount';

    // Reading through the caller's own client proves they are part of the order
    const { data: order } = await getUserSupabase(token)
      .from(table)
      .select(`id, payment_id, payment_status, ${amountColumn}`)
      .eq('id', orderId)
      .maybeSingle<{ id: string; payment_id: string; payment_status: string; amount?: number; total_amount?: number }>();
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    if (order.payment_status === 'refunded') return NextResponse.json({ success: true, alreadyRefunded: true });
    if (order.payment_status !== 'refund_pending' || !order.payment_id) {
      return NextResponse.json({ error: 'This order has nothing to refund' }, { status: 400 });
    }

    const amount = Number(order.amount ?? order.total_amount ?? 0);
    const refund = await razorpayClient().payments.refund(order.payment_id, { amount: Math.round(amount * 100) });

    const db = getServiceSupabase();
    await db.from(table).update({ payment_status: 'refunded' }).eq('id', orderId);
    await db.from('payments').update({ status: 'refunded' }).eq('razorpay_payment_id', order.payment_id);

    return NextResponse.json({ success: true, refundId: refund.id });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error('Refund error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Refund failed' }, { status: 500 });
  }
}
