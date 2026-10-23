import { NextResponse } from 'next/server';
import { getErrorMessage } from '@/lib/error-utils';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuth, isNonEmptyString } from '@/lib/verify-auth';
import crypto from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: Request) {
  try {
    const { uid: verifiedSellerId } = await verifyAuth(request);

    const { orderId, type } = await request.json() as {
      orderId?: string;
      type?: 'pickup' | 'return';
    };

    if (!isNonEmptyString(orderId) || !isNonEmptyString(type)) {
      return NextResponse.json({ error: 'Missing required fields: orderId, type' }, { status: 400 });
    }

    if (!adminDb) {
      return NextResponse.json({ error: 'Firebase Admin not initialized.' }, { status: 500 });
    }
    
    const db = adminDb;
    const orderRef = db.collection('orders').doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const orderData = orderSnap.data()!;
    if (orderData.sellerId !== verifiedSellerId) {
      return NextResponse.json({ error: 'Unauthorized: You are not the seller for this order' }, { status: 403 });
    }

    // Generate a secure random token
    const randomHex = crypto.randomBytes(32).toString('hex');
    const token = `${type}:${randomHex}`;
    const expiryTime = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    const qrTokenRef = db.collection('qr_tokens').doc();
    
    const tokenData = {
      orderId,
      sellerId: verifiedSellerId,
      customerId: orderData.buyerId,
      type,
      token,
      used: false,
      expiresAt: expiryTime,
      createdAt: FieldValue.serverTimestamp(),
    };

    await qrTokenRef.set(tokenData);

    return NextResponse.json({ 
      success: true, 
      token,
      expiresAt: expiryTime.toISOString()
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json({ error: getErrorMessage(error, 'Failed to generate QR') }, { status: 400 });
  }
}
