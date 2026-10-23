import { NextResponse } from 'next/server';
import { getErrorMessage } from '@/lib/error-utils';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuth, isNonEmptyString } from '@/lib/verify-auth';

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
    
    await db.runTransaction(async (tx) => {
      // Find the token
      const tokenQuery = await tx.get(db.collection('qr_tokens').where('token', '==', token).limit(1));
      if (tokenQuery.empty) throw new Error('Invalid QR code.');
      
      const tokenDoc = tokenQuery.docs[0];
      const tokenData = tokenDoc.data();
      
      if (tokenData.used) throw new Error('QR code has already been used.');
      if (tokenData.type !== 'pickup') throw new Error('Invalid QR type. Expected pickup.');
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
      const sellerData = sellerSnap.data()!;

      if (!orderData.escrowLocked) {
        throw new Error('Funds have already been released for this order');
      }

      if (!orderData.escrowAmount || orderData.escrowAmount <= 0) {
        throw new Error('Invalid escrow amount');
      }

      const isRental = orderData.type === 'rental';

      // Update Order
      const orderUpdates: Record<string, unknown> = {
        escrowLocked: false,
        status: isRental ? 'active' : 'completed',
      };
      
      // Credit seller's earnings (not wallet)
      const amountToRelease = orderData.escrowAmount;
      const currentEarnings = sellerData.earnings || 0;
      tx.update(sellerRef, { earnings: currentEarnings + amountToRelease });
      
      if (isRental) {
        orderUpdates.rentalStartedAt = new Date(); // Timer starts NOW
      }
      
      tx.update(orderRef, orderUpdates);
      tx.update(tokenDoc.ref, { used: true });
      
      verifiedOrderData = {
        id: tokenData.orderId,
        ...orderData,
        ...orderUpdates
      };
    });

    return NextResponse.json({ success: true, order: verifiedOrderData });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json({ error: getErrorMessage(error, 'Failed to verify pickup QR') }, { status: 400 });
  }
}
