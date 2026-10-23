import { NextResponse } from 'next/server';
import { getErrorMessage } from '@/lib/error-utils';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuth, isNonEmptyString } from '@/lib/verify-auth';
import { clearCache } from '@/lib/cache';

export async function POST(request: Request) {
  try {
    const { uid: verifiedBuyerId } = await verifyAuth(request);

    const { token } = await request.json() as { token?: string };

    if (!isNonEmptyString(token)) {
      return NextResponse.json({ error: 'Missing required field: token' }, { status: 400 });
    }

    if (!adminDb) {
      return NextResponse.json({ error: 'Firebase Admin not initialized.' }, { status: 500 });
    }
    
    const db = adminDb;
    let verifiedOrderData: Record<string, unknown> | null = null;
    let calculatedLateFee = 0;
    
    await db.runTransaction(async (tx) => {
      // Find the token
      const tokenQuery = await tx.get(db.collection('qr_tokens').where('token', '==', token).limit(1));
      if (tokenQuery.empty) throw new Error('Invalid QR code.');
      
      const tokenDoc = tokenQuery.docs[0];
      const tokenData = tokenDoc.data();
      
      if (tokenData.used) throw new Error('QR code has already been used.');
      if (tokenData.type !== 'return') throw new Error('Invalid QR type. Expected return.');
      if (tokenData.customerId !== verifiedBuyerId) throw new Error('Unauthorized: This QR is for a different customer.');
      
      const expiresAt = tokenData.expiresAt?.toDate();
      if (!expiresAt || expiresAt.getTime() < Date.now()) {
        throw new Error('QR code has expired. Please ask the seller to generate a new one.');
      }

      const orderRef = db.collection('orders').doc(tokenData.orderId);
      const sellerRef = db.collection('users').doc(tokenData.sellerId);

      const orderSnap = await tx.get(orderRef);
      const sellerSnap = await tx.get(sellerRef);

      if (!orderSnap.exists) throw new Error('Order not found');
      if (!sellerSnap.exists) throw new Error('Seller not found');

      const orderData = orderSnap.data()!;

      if (orderData.type !== 'rental') {
        throw new Error('Return QR scans are only for rental orders.');
      }
      if (orderData.status !== 'active') {
        throw new Error('Order is not currently an active rental.');
      }

      // Calculate Late Fee
      const rentalStartedAt = orderData.rentalStartedAt?.toDate();
      if (!rentalStartedAt) {
        throw new Error('Rental start time is missing.');
      }

      const rentalDays = orderData.rentalDays || 1;
      const totalDurationMs = rentalDays * 24 * 60 * 60 * 1000;
      const returnDeadline = rentalStartedAt.getTime() + totalDurationMs;
      
      const currentTime = Date.now();
      
      if (currentTime > returnDeadline) {
        const lateHours = Math.ceil((currentTime - returnDeadline) / (1000 * 60 * 60));
        // Fine Formula: Fine = Rental Price × 30% × Late Hours
        calculatedLateFee = Math.floor(orderData.amount * 0.3 * lateHours);
      }

      // Late fees are tracked as pending — buyer must pay separately via Razorpay
      // We no longer deduct from wallet

      const orderUpdates: Record<string, unknown> = {
        status: 'completed',
        lateFee: calculatedLateFee,
        lateFeePaid: calculatedLateFee === 0,
        returnedAt: new Date()
      };
      
      tx.update(orderRef, orderUpdates);
      tx.update(tokenDoc.ref, { used: true });
      
      // Update product status back to available
      const productRef = db.collection('products').doc(orderData.productId);
      tx.update(productRef, { status: 'available' });
      
      verifiedOrderData = {
        id: tokenData.orderId,
        ...orderData,
        ...orderUpdates
      };
    });

    // Clear product cache so the returned item shows up immediately
    clearCache('available_products_list');

    return NextResponse.json({ 
      success: true, 
      order: verifiedOrderData,
      lateFee: calculatedLateFee,
      lateFeePending: calculatedLateFee > 0,
      message: calculatedLateFee > 0 ? `Returned with a pending late fee of ₹${calculatedLateFee}. Buyer will be charged separately.` : 'Returned successfully on time.'
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json({ error: getErrorMessage(error, 'Failed to verify return QR') }, { status: 400 });
  }
}
