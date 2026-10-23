'use client';

import { useEffect, useState } from 'react';
import { authFetch } from './auth-fetch';

interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open: () => void;
  on: (event: string, cb: (r: { error: { description: string } }) => void) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

let onlineCheck: Promise<boolean> | null = null;

/** Whether the server has Razorpay + a service-role key configured */
export function useOnlinePayments(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let cancelled = false;
    onlineCheck ??= fetch('/api/payment/config')
      .then(r => r.json())
      .then(d => Boolean(d.online))
      .catch(() => false);
    onlineCheck.then(v => { if (!cancelled) setEnabled(v); });
    return () => { cancelled = true; };
  }, []);
  return enabled;
}

function loadRazorpay(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const existing = document.getElementById('razorpay-script') as HTMLScriptElement | null;
    const script = existing ?? document.createElement('script');
    script.id = 'razorpay-script';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load the payment window. Check your connection.'));
    if (!existing) document.body.appendChild(script);
  });
}

interface CheckoutInput {
  /** What is being paid for */
  kind: 'order' | 'print_order';
  /** Server-side payload for /api/payment/create-*; the server prices it */
  payload: Record<string, unknown>;
  description: string;
  prefill: { name?: string; email?: string; contact?: string };
}

/**
 * Runs Razorpay checkout and resolves with the created order id once the
 * server has verified the payment.
 */
export async function payOnline({ kind, payload, description, prefill }: CheckoutInput): Promise<string> {
  const createUrl = kind === 'order' ? '/api/payment/create-order' : '/api/payment/create-print-order';
  const verifyUrl = kind === 'order' ? '/api/payment/verify' : '/api/payment/verify-print-order';

  const res = await authFetch(createUrl, { method: 'POST', body: JSON.stringify(payload) });
  const order = await res.json();
  if (!res.ok) throw new Error(order.error || 'Could not start the payment');

  await loadRazorpay();
  const Razorpay = window.Razorpay;
  if (!Razorpay) throw new Error('Payment window unavailable');

  return new Promise<string>((resolve, reject) => {
    const rzp = new Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency || 'INR',
      name: 'Lendly',
      description,
      order_id: order.id,
      prefill,
      theme: { color: '#f97316' },
      handler: async (response: RazorpayResponse) => {
        try {
          const verifyRes = await authFetch(verifyUrl, { method: 'POST', body: JSON.stringify(response) });
          const data = await verifyRes.json();
          if (!verifyRes.ok) throw new Error(data.error || 'Payment verification failed');
          resolve(data.orderId);
        } catch (err) {
          reject(err);
        }
      },
      modal: { ondismiss: () => reject(new Error('Payment cancelled')) },
    });
    rzp.on('payment.failed', r => reject(new Error(r.error.description || 'Payment failed')));
    rzp.open();
  });
}

/** Asks the server to return money for an online order that was cancelled or declined */
export async function requestRefund(orderId: string, kind: 'order' | 'print_order' = 'order'): Promise<void> {
  const res = await authFetch('/api/payment/refund', { method: 'POST', body: JSON.stringify({ orderId, kind }) });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Refund could not be started');
  }
}
