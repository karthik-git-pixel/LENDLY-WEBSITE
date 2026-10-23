import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
import { verifyAuth, isPositiveFiniteNumber, isNonEmptyString } from '@/lib/verify-auth';

export async function POST(request: Request) {
  try {
    const { uid: verifiedSellerId } = await verifyAuth(request);

    const { amount, payoutMethod, destination } = await request.json() as {
      amount?: number;
      payoutMethod?: 'upi' | 'bank_transfer';
      destination?: string;
    };

    if (!isPositiveFiniteNumber(amount) || amount < 50) {
      return NextResponse.json({ error: 'Minimum withdrawal amount is ₹50' }, { status: 400 });
    }

    if (!payoutMethod || (payoutMethod !== 'upi' && payoutMethod !== 'bank_transfer')) {
      return NextResponse.json({ error: 'Invalid payout method. Choose UPI or Bank Transfer' }, { status: 400 });
    }

    if (!isNonEmptyString(destination) || destination.trim().length < 4) {
      return NextResponse.json({ error: 'Please provide a valid UPI ID or Bank Account Details' }, { status: 400 });
    }

    if (!adminDb) {
      return NextResponse.json({ error: 'Firebase Admin not initialized.' }, { status: 500 });
    }

    const db = adminDb;
    const userRef = db.collection('users').doc(verifiedSellerId);
    let withdrawalId = '';

    // Atomic transaction: verify balance and deduct earnings
    await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) {
        throw new Error('User profile not found');
      }

      const userData = userSnap.data()!;
      const currentEarnings = Number(userData.earnings) || 0;

      if (currentEarnings < amount) {
        throw new Error(`Insufficient earnings balance. Available: ₹${currentEarnings.toLocaleString()}`);
      }

      // Deduct earnings balance
      tx.update(userRef, {
        earnings: currentEarnings - amount,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Create withdrawal request record
      const withdrawalRef = db.collection('withdrawals').doc();
      withdrawalId = withdrawalRef.id;

      tx.set(withdrawalRef, {
        sellerId: verifiedSellerId,
        sellerName: userData.displayName || 'Seller',
        sellerEmail: userData.email || '',
        amount,
        payoutMethod,
        destination: destination.trim(),
        status: 'pending',
        requestedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    return NextResponse.json({
      success: true,
      withdrawalId,
      message: `Withdrawal request of ₹${amount.toLocaleString()} submitted successfully. Funds will be transferred to ${destination.trim()} within 24-48 hours.`,
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error('Withdrawal Error:', error);
    const message = error instanceof Error ? error.message : 'Withdrawal failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
