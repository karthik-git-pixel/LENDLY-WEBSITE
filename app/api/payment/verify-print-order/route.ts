import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { adminDb } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
import { verifyAuth, isPositiveFiniteNumber, isNonEmptyString, MAX_TRANSACTION_AMOUNT } from '@/lib/verify-auth';

export async function POST(request: Request) {
  try {
    const { uid: verifiedBuyerId } = await verifyAuth(request);

    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      providerId,
      amount,
      fileUrls,
      fileNames,
      pageCount,
      copies,
      colorMode,
      orientation,
      paperSize,
      sides,
      specialInstructions,
      deliveryAddress,
      deliveryLocation,
      buyerName,
      buyerPhone,
    } = await request.json() as {
      razorpay_payment_id?: string;
      razorpay_order_id?: string;
      razorpay_signature?: string;
      providerId?: string;
      amount?: number;
      fileUrls?: string[];
      fileNames?: string[];
      pageCount?: number;
      copies?: number;
      colorMode?: 'bw' | 'color';
      orientation?: 'portrait' | 'landscape';
      paperSize?: 'A4' | 'A3' | 'A5' | 'Letter' | 'Legal';
      sides?: 'single' | 'double';
      specialInstructions?: string;
      deliveryAddress?: string;
      deliveryLocation?: { lat: number; lng: number };
      buyerName?: string;
      buyerPhone?: string;
    };

    // Validate required fields
    if (!isPositiveFiniteNumber(amount)) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }
    if (!isNonEmptyString(razorpay_payment_id) || !isNonEmptyString(razorpay_order_id) || !isNonEmptyString(razorpay_signature)) {
      return NextResponse.json({ error: 'Missing Razorpay payment details' }, { status: 400 });
    }
    if (!isNonEmptyString(providerId)) {
      return NextResponse.json({ error: 'Missing print provider ID' }, { status: 400 });
    }
    if (!Array.isArray(fileUrls) || fileUrls.length === 0) {
      return NextResponse.json({ error: 'No files provided for printing' }, { status: 400 });
    }
    if (amount > MAX_TRANSACTION_AMOUNT) {
      return NextResponse.json({ error: `Amount exceeds maximum limit of ₹${MAX_TRANSACTION_AMOUNT.toLocaleString()}` }, { status: 400 });
    }
    if (verifiedBuyerId === providerId) {
      return NextResponse.json({ error: 'Cannot purchase from yourself' }, { status: 400 });
    }

    const key_secret = process.env.RAZORPAY_KEY_SECRET?.replace(/^"|"$/g, '');
    if (!key_secret) {
      return NextResponse.json({ error: 'Payment gateway not configured' }, { status: 500 });
    }

    // Verify HMAC SHA256 signature
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', key_secret)
      .update(body)
      .digest('hex');

    const isAuthentic = crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(razorpay_signature, 'hex')
    );

    if (!isAuthentic) {
      return NextResponse.json({ error: 'Payment verification failed: Invalid signature' }, { status: 400 });
    }

    if (!adminDb) {
      return NextResponse.json({ error: 'Firebase Admin not initialized' }, { status: 500 });
    }

    const db = adminDb;

    // Verify print provider and fetch details
    const providerSnap = await db.collection('users').doc(providerId).get();
    if (!providerSnap.exists) {
      return NextResponse.json({ error: 'Print provider not found' }, { status: 404 });
    }
    const providerData = providerSnap.data()!;
    const providerName = providerData.storeName || providerData.displayName || 'Print Hub';
    const providerAvatar = providerData.avatarUrl || '';

    // Fetch buyer details
    const buyerSnap = await db.collection('users').doc(verifiedBuyerId).get();
    const buyerData = buyerSnap.exists ? buyerSnap.data()! : {};
    const finalBuyerName = buyerName || buyerData.displayName || 'Customer';
    const finalBuyerPhone = buyerPhone || buyerData.phone || '';

    const rateBW = providerData.printPriceBW ?? 2;
    const rateColor = providerData.printPriceColor ?? 10;
    const pricePerPage = colorMode === 'color' ? rateColor : rateBW;

    // Create the PrintOrder record
    const printOrderRef = await db.collection('print_orders').add({
      buyerId: verifiedBuyerId,
      buyerName: finalBuyerName,
      buyerPhone: finalBuyerPhone,
      buyerEmail: buyerData.email || '',
      providerId,
      providerName,
      providerAvatar,
      providerPhone: providerData.phone || '',
      fileUrls: fileUrls || [],
      fileNames: fileNames || [],
      pageCount: pageCount || 1,
      copies: copies || 1,
      colorMode: colorMode || 'bw',
      orientation: orientation || 'portrait',
      paperSize: paperSize || 'A4',
      sides: sides || 'single',
      specialInstructions: specialInstructions || '',
      deliveryAddress: deliveryAddress || buyerData.location?.address || 'Buyer Address',
      deliveryLocation: deliveryLocation || buyerData.location || { lat: 0, lng: 0 },
      pricePerPage,
      totalAmount: amount,
      status: 'pending',
      razorpayPaymentId: razorpay_payment_id,
      razorpayOrderId: razorpay_order_id,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Notify the provider
    await db.collection('notifications').add({
      userId: providerId,
      title: '🖨️ New Print Order Paid!',
      body: `${finalBuyerName} paid ₹${amount} for a ${colorMode?.toUpperCase() || 'B&W'} print order (${pageCount || 1} pages × ${copies || 1} copies).`,
      type: 'print_order',
      read: false,
      data: { printOrderId: printOrderRef.id },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      printOrderId: printOrderRef.id,
      message: 'Payment verified and print order confirmed',
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error('Print Payment Verification Error:', error);
    const errorMsg = error instanceof Error ? error.message : 'Verification failed';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
