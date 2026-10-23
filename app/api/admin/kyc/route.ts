import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
import { verifyAuth } from '@/lib/verify-auth';
import { decryptData } from '@/lib/encryption';

const maskString = (str: string | null | undefined, showLast = 4) => {
  if (!str) return 'N/A';
  if (str === 'ENCRYPTION_ERROR') return 'DECRYPTION FAILED';
  if (str.length <= showLast) return str;
  return '*'.repeat(str.length - showLast) + str.slice(-showLast);
};

async function isAdmin(request: Request): Promise<{ isAdmin: boolean; uid?: string; error?: string }> {
  try {
    const { uid, email } = await verifyAuth(request);
    
    // Fallback email for development if env var is missing
    const adminEmails = (process.env.ADMIN_EMAILS || 'admin@radiuscart.com').split(',').map(e => e.trim());
    
    if (!email || !adminEmails.includes(email)) {
      return { isAdmin: false, error: 'Unauthorized: Admin access required' };
    }
    
    return { isAdmin: true, uid };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Authentication failed';
    return { isAdmin: false, error: errorMsg };
  }
}

export async function GET(request: Request) {
  try {
    const authCheck = await isAdmin(request);
    if (!authCheck.isAdmin) return NextResponse.json({ error: authCheck.error }, { status: 403 });

    if (!adminDb) return NextResponse.json({ error: 'DB not initialized' }, { status: 500 });
    
    const db = adminDb;
    // Fetch users with PENDING_VERIFICATION
    const usersSnap = await db.collection('users')
      .where('kycStatus', '==', 'PENDING_VERIFICATION')
      .get();
      
    const applications = await Promise.all(usersSnap.docs.map(async (userDoc) => {
      const userData = userDoc.data();
      const kycDoc = await db.collection('users').doc(userDoc.id).collection('kyc_private').doc('data').get();
      
      let kycData = null;
      if (kycDoc.exists) {
        const raw = kycDoc.data()!;
        
        // Decrypt and mask
        kycData = {
          personal: raw.personal,
          address: raw.address,
          identity: {
            panNumberMasked: maskString(decryptData(raw.identity?.panNumber), 4),
            governmentIdMasked: raw.identity?.governmentIdNumber ? maskString(decryptData(raw.identity.governmentIdNumber), 4) : 'N/A'
          },
          bank: {
            accountHolder: raw.bank?.accountHolder,
            accountNumberMasked: maskString(decryptData(raw.bank?.accountNumber), 4),
            ifsc: raw.bank?.ifsc
          },
          business: raw.business ? {
            businessName: raw.business.businessName,
            businessPanMasked: maskString(decryptData(raw.business.businessPan), 4),
            gstin: raw.business.gstin
          } : null,
          submittedAt: raw.submittedAt?.toDate?.()?.toISOString() || null
        };
      }

      return {
        uid: userDoc.id,
        email: userData.email,
        displayName: userData.displayName,
        kycStatus: userData.kycStatus,
        kycData
      };
    }));

    return NextResponse.json({ applications });
  } catch (error: unknown) {
    console.error('Admin KYC GET Error:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authCheck = await isAdmin(request);
    if (!authCheck.isAdmin) return NextResponse.json({ error: authCheck.error }, { status: 403 });

    const { targetUid, action, reason } = await request.json();
    
    if (!targetUid || !action || !['APPROVE', 'REJECT'].includes(action)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    if (!adminDb) return NextResponse.json({ error: 'DB not initialized' }, { status: 500 });
    const db = adminDb;
    
    const userRef = db.collection('users').doc(targetUid);
    
    if (action === 'APPROVE') {
      await userRef.update({
        kycStatus: 'VERIFIED',
        kycRejectionReason: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      // Optionally: Trigger email to user
    } else if (action === 'REJECT') {
      if (!reason) return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 });
      await userRef.update({
        kycStatus: 'REJECTED',
        kycRejectionReason: reason,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      // Optionally: Trigger email to user
    }

    // Maintain an audit log (as requested in spec: Maintain an audit log for KYC status changes)
    await db.collection('kyc_audit_logs').add({
      targetUid,
      adminUid: authCheck.uid,
      action,
      reason: reason || null,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Admin KYC POST Error:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
