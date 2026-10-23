import { NextResponse } from 'next/server';
import { getErrorMessage } from '@/lib/error-utils';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuth, isNonEmptyString } from '@/lib/verify-auth';
import { clearCache } from '@/lib/cache';

export async function POST(request: Request) {
  try {
    const { uid: verifiedUserId } = await verifyAuth(request);
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
    let actionType = '';
    
    await db.runTransaction(async (tx) => {
      // Find the order by qrCode
      const orderQuery = await tx.get(db.collection('orders').where('qrCode', '==', token).limit(1));
      if (orderQuery.empty) throw new Error('Invalid Order QR code.');
      
      const orderDoc = orderQuery.docs[0];
      const orderData = orderDoc.data();
      
      // Ensure the scanner is the seller of this order
      if (orderData.sellerId !== verifiedUserId) {
        throw new Error('Unauthorized: Only the seller can scan this QR code to confirm handoff.');
      }
      
      const sellerRef = db.collection('users').doc(orderData.sellerId);
      const buyerRef = db.collection('users').doc(orderData.buyerId);
      
      const [sellerSnap, buyerSnap] = await Promise.all([
        tx.get(sellerRef),
        tx.get(buyerRef)
      ]);
      
      if (!sellerSnap.exists) throw new Error('Seller not found');
      if (!buyerSnap.exists) throw new Error('Buyer not found');
      
      const sellerData = sellerSnap.data()!;
      
      const orderUpdates: Record<string, unknown> = {};
      
      if (orderData.status === 'pending') {
        // This is a Pickup
        actionType = 'pickup';
        if (!orderData.escrowLocked) {
          throw new Error('Funds have already been released for this order');
        }
        
        if (!orderData.escrowAmount || orderData.escrowAmount <= 0) {
          throw new Error('Invalid escrow amount');
        }
        
        const isRental = orderData.type === 'rental';
        orderUpdates.escrowLocked = false;
        orderUpdates.status = isRental ? 'active' : 'completed';
        
        // Credit seller's earnings (not wallet)
        const amountToRelease = orderData.escrowAmount;
        const currentEarnings = sellerData.earnings || 0;
        tx.update(sellerRef, { earnings: currentEarnings + amountToRelease });
        
        if (isRental) {
          orderUpdates.rentalStartedAt = new Date();
        }
      } else if (orderData.status === 'active' || orderData.status === 'confirmed') {
        // This is a Return
        if (orderData.type !== 'rental') {
          throw new Error('Return QR scans are only for rental orders.');
        }
        actionType = 'return';
        
        // Calculate Late Fee
        const rentalStartedAt = orderData.rentalStartedAt?.toDate();
        if (!rentalStartedAt) throw new Error('Rental start time is missing.');
        
        const rentalDays = orderData.rentalDays || 1;
        const totalDurationMs = rentalDays * 24 * 60 * 60 * 1000;
        const returnDeadline = rentalStartedAt.getTime() + totalDurationMs;
        const currentTime = Date.now();
        
        if (currentTime > returnDeadline) {
          const lateHours = Math.ceil((currentTime - returnDeadline) / (1000 * 60 * 60));
          calculatedLateFee = Math.floor(orderData.amount * 0.3 * lateHours);
        }
        
        // Late fees are tracked as pending — buyer must pay separately via Razorpay
        // We don't deduct from wallet anymore
        
        orderUpdates.status = 'completed';
        orderUpdates.lateFee = calculatedLateFee;
        orderUpdates.returnedAt = new Date();
        orderUpdates.lateFeePaid = calculatedLateFee === 0; // Already paid if no late fee
        
        // Update product status back to available
        const productRef = db.collection('products').doc(orderData.productId);
        tx.update(productRef, { status: 'available' });
      } else if (orderData.status === 'completed') {
        throw new Error('This order is already completed.');
      } else {
        throw new Error(`Cannot process order with status: ${orderData.status}`);
      }
      
      tx.update(orderDoc.ref, orderUpdates);
      
      verifiedOrderData = {
        id: orderDoc.id,
        ...orderData,
        ...orderUpdates
      };
    });

    let message = '';
    if (actionType === 'pickup') {
      message = 'Handoff Confirmed! Payment released to seller earnings.';
    } else if (actionType === 'return') {
      message = calculatedLateFee > 0 ? `Returned with a pending late fee of ₹${calculatedLateFee}` : 'Returned successfully on time.';
      // Clear product cache so the returned item shows up immediately
      clearCache('available_products_list');
    }

    return NextResponse.json({ 
      success: true, 
      order: verifiedOrderData,
      lateFee: calculatedLateFee,
      lateFeePending: calculatedLateFee > 0,
      message,
      actionType
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json({ error: getErrorMessage(error, 'Failed to verify order QR') }, { status: 400 });
  }
}
