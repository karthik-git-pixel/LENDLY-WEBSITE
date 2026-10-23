import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
import { verifyAuth, isNonEmptyString } from '@/lib/verify-auth';
import { encryptData } from '@/lib/encryption';

export async function POST(request: Request) {
  try {
    const { uid: verifiedUserId } = await verifyAuth(request);
    const payload = await request.json();

    if (!adminDb) {
      return NextResponse.json({ error: 'Firebase Admin not initialized' }, { status: 500 });
    }

    const db = adminDb;

    // Validate essential fields
    if (!payload.personal?.fullName || !payload.personal?.email) {
      return NextResponse.json({ error: 'Personal details are required' }, { status: 400 });
    }
    if (!payload.identity?.panNumber) {
      return NextResponse.json({ error: 'PAN Number is required' }, { status: 400 });
    }
    if (!payload.address?.address || !payload.address?.state || !payload.address?.district || !payload.address?.pinCode) {
      return NextResponse.json({ error: 'Full address is required' }, { status: 400 });
    }
    if (!payload.bank?.accountHolder || !payload.bank?.accountNumber || !payload.bank?.ifsc) {
      return NextResponse.json({ error: 'Bank details are required' }, { status: 400 });
    }

    // Encrypt sensitive fields
    const encryptedKycData = {
      personal: payload.personal,
      address: payload.address,
      identity: {
        ...payload.identity,
        panNumber: encryptData(payload.identity.panNumber),
        governmentIdNumber: payload.identity.governmentIdNumber ? encryptData(payload.identity.governmentIdNumber) : null,
      },
      bank: {
        ...payload.bank,
        accountNumber: encryptData(payload.bank.accountNumber),
      },
      business: payload.business ? {
        ...payload.business,
        businessPan: encryptData(payload.business.businessPan),
      } : null,
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // 1. Write to private KYC subcollection (secure from public queries)
    const privateKycRef = db.collection('users').doc(verifiedUserId).collection('kyc_private').doc('data');
    await privateKycRef.set(encryptedKycData, { merge: true });

    // 2. Update user profile kycStatus to 'PENDING_VERIFICATION' via Server Admin SDK
    const userRef = db.collection('users').doc(verifiedUserId);
    await userRef.update({
      kycStatus: 'PENDING_VERIFICATION',
      kycRejectionReason: admin.firestore.FieldValue.delete(), // Clear old reason
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, message: 'KYC application submitted securely' });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error('KYC Submit Error:', error);
    const message = error instanceof Error ? error.message : 'KYC submission failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
