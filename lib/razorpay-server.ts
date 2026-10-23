import crypto from 'crypto';
import Razorpay from 'razorpay';
import { getRazorpayKeys, getServiceSupabase } from './supabase-server';

export function razorpayClient(): Razorpay {
  const keys = getRazorpayKeys();
  if (!keys) throw new Error('Payment gateway not configured');
  return new Razorpay({ key_id: keys.keyId, key_secret: keys.keySecret });
}

/** Constant-time check of the checkout signature */
export function isValidCheckoutSignature(orderId: string, paymentId: string, signature: string): boolean {
  const keys = getRazorpayKeys();
  if (!keys) return false;
  const expected = crypto.createHmac('sha256', keys.keySecret).update(`${orderId}|${paymentId}`).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Makes sure the money is actually captured, capturing authorised payments */
export async function ensureCaptured(paymentId: string): Promise<{ amount: number; orderId: string }> {
  const razorpay = razorpayClient();
  let payment = await razorpay.payments.fetch(paymentId);
  if (payment.status === 'authorized') {
    payment = await razorpay.payments.capture(paymentId, payment.amount, payment.currency || 'INR');
  }
  if (payment.status !== 'captured') {
    throw new Error('Payment was not captured');
  }
  return { amount: Number(payment.amount) / 100, orderId: String(payment.order_id) };
}

type Notes = Record<string, string>;

/**
 * Turns a captured Razorpay payment into a Lendly order (or print order)
 * using the details stored in the Razorpay order's notes. Idempotent:
 * the client callback and the webhook may both call it.
 */
export async function recordPaidOrder(paymentId: string, expectedBuyer?: string): Promise<{ orderId: string; kind: string }> {
  const razorpay = razorpayClient();
  const { amount, orderId: razorpayOrderId } = await ensureCaptured(paymentId);
  const rzOrder = await razorpay.orders.fetch(razorpayOrderId);
  const notes = (rzOrder.notes || {}) as Notes;

  if (expectedBuyer && notes.buyerId !== expectedBuyer) {
    throw new Error('This payment belongs to a different account');
  }
  if (Math.round(amount * 100) !== Number(rzOrder.amount)) {
    throw new Error('Paid amount does not match the order');
  }

  const db = getServiceSupabase();
  await db.from('payments').upsert({
    razorpay_payment_id: paymentId,
    razorpay_order_id: razorpayOrderId,
    user_id: notes.buyerId || null,
    amount,
    kind: notes.kind || 'order',
    status: 'captured',
    notes,
  });

  try {
    if (notes.kind === 'print_order') {
      const files = JSON.parse(notes.files || '{"paths":[],"names":[]}') as { paths: string[]; names: string[] };
      const { data, error } = await db.rpc('create_paid_print_order', {
        p_buyer: notes.buyerId,
        p_provider_id: notes.providerId,
        p_file_paths: files.paths,
        p_file_names: files.names,
        p_copies: Number(notes.copies),
        p_page_count: Number(notes.pageCount),
        p_color_mode: notes.colorMode,
        p_paper_size: notes.paperSize,
        p_orientation: notes.orientation,
        p_sides: notes.sides,
        p_instructions: notes.instructions || '',
        p_address: notes.address || '',
        p_phone: notes.phone || '',
        p_amount: amount,
        p_payment_id: paymentId,
        p_razorpay_order_id: razorpayOrderId,
      });
      if (error) throw new Error(error.message);
      return { orderId: (data as { id: string }).id, kind: 'print_order' };
    }

    const { data, error } = await db.rpc('create_paid_order', {
      p_buyer: notes.buyerId,
      p_product_id: notes.productId,
      p_start: notes.start || null,
      p_end: notes.end || null,
      p_notes: notes.notes || '',
      p_amount: amount,
      p_payment_id: paymentId,
      p_razorpay_order_id: razorpayOrderId,
    });
    if (error) throw new Error(error.message);
    return { orderId: (data as { id: string }).id, kind: 'order' };
  } catch (err) {
    // Another call may have recorded this payment a moment earlier
    const table = notes.kind === 'print_order' ? 'print_orders' : 'orders';
    const { data: existing } = await db.from(table).select('id').eq('payment_id', paymentId).maybeSingle();
    if (existing) return { orderId: existing.id as string, kind: notes.kind || 'order' };

    // The slot or item was taken while paying — give the money back
    await razorpay.payments.refund(paymentId, { amount: Math.round(amount * 100) }).catch(() => undefined);
    await db.from('payments').update({ status: 'refunded_unfulfilled' }).eq('razorpay_payment_id', paymentId);
    throw new Error(`${err instanceof Error ? err.message : 'Order could not be created'} — your payment has been refunded.`);
  }
}
