import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuth, isPositiveFiniteNumber, isNonEmptyString, MAX_TRANSACTION_AMOUNT } from '@/lib/verify-auth';

export async function POST(request: Request) {
  try {
    const { uid: verifiedBuyerId } = await verifyAuth(request);

    const {
      providerId,
      amount,
      pageCount,
      copies,
      colorMode,
      paperSize,
      sides,
    } = await request.json() as {
      providerId?: string;
      amount?: number;
      pageCount?: number;
      copies?: number;
      colorMode?: 'bw' | 'color';
      paperSize?: string;
      sides?: string;
    };

    // Input validation
    if (!isNonEmptyString(providerId) || !isPositiveFiniteNumber(amount) || !isPositiveFiniteNumber(pageCount) || !isPositiveFiniteNumber(copies)) {
      return NextResponse.json({ error: 'Missing or invalid required fields' }, { status: 400 });
    }

    if (amount > MAX_TRANSACTION_AMOUNT) {
      return NextResponse.json({ error: `Amount exceeds maximum limit of ₹${MAX_TRANSACTION_AMOUNT.toLocaleString()}` }, { status: 400 });
    }

    if (verifiedBuyerId === providerId) {
      return NextResponse.json({ error: 'Cannot create a print order for yourself' }, { status: 400 });
    }

    if (!adminDb) {
      return NextResponse.json({ error: 'Firebase Admin not initialized.' }, { status: 500 });
    }

    // Verify provider exists and has print service active
    const db = adminDb;
    const providerSnap = await db.collection('users').doc(providerId).get();
    if (!providerSnap.exists) {
      return NextResponse.json({ error: 'Print provider not found' }, { status: 404 });
    }

    const providerData = providerSnap.data()!;
    const rateBW = providerData.printPriceBW ?? 2;
    const rateColor = providerData.printPriceColor ?? 10;
    const pricePerPage = colorMode === 'color' ? rateColor : rateBW;

    const serverExpectedPrice = Math.max(1, pricePerPage * pageCount * copies);

    if (Math.abs(amount - serverExpectedPrice) > 0.01) {
      return NextResponse.json({ error: 'Price calculation mismatch. Please refresh and try again.' }, { status: 400 });
    }

    // Create Razorpay order
    const key_id = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.replace(/^"|"$/g, '');
    const key_secret = process.env.RAZORPAY_KEY_SECRET?.replace(/^"|"$/g, '');

    if (!key_id || !key_secret) {
      return NextResponse.json({ error: 'Payment gateway not configured' }, { status: 500 });
    }

    const razorpay = new Razorpay({ key_id, key_secret });

    const order = await razorpay.orders.create({
      amount: Math.round(serverExpectedPrice * 100), // paise
      currency: 'INR',
      receipt: `rcart_print_${Date.now()}`,
      notes: {
        buyerId: verifiedBuyerId,
        providerId,
        type: 'print_order',
        colorMode: colorMode || 'bw',
        paperSize: paperSize || 'A4',
        pageCount: pageCount.toString(),
        copies: copies.toString(),
      },
    });

    return NextResponse.json({
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      providerId,
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error('Print Payment Order Creation Error:', error);
    const errorMsg = error instanceof Error ? error.message : 'Failed to create payment order';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
