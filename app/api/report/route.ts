import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
import { getErrorMessage } from '@/lib/error-utils';
import { verifyAuth, isNonEmptyString } from '@/lib/verify-auth';

export async function POST(request: Request) {
  try {
    // Verify authentication — use the verified UID as the reporter
    const { uid: verifiedReporterId } = await verifyAuth(request);

    const { productId, sellerId, reason, description } = await request.json() as {
      productId?: string;
      sellerId?: string;
      reason?: string;
      description?: string;
    };

    if (!isNonEmptyString(productId) || !isNonEmptyString(reason)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate reason and description length
    if (reason.length > 500) {
      return NextResponse.json({ error: 'Reason is too long (max 500 characters)' }, { status: 400 });
    }

    if (description && description.length > 2000) {
      return NextResponse.json({ error: 'Description is too long (max 2000 characters)' }, { status: 400 });
    }

    if (!adminDb) {
      return NextResponse.json({ error: 'Firebase Admin not initialized.' }, { status: 500 });
    }

    const db = adminDb;
    await db.collection('reports').add({
      reporterId: verifiedReporterId,
      productId,
      sellerId: sellerId || '',
      reason,
      description: description || '',
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json({ error: getErrorMessage(error, 'Failed to submit report') }, { status: 500 });
  }
}
