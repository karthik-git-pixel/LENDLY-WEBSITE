import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/verify-auth';
import { encryptData } from '@/lib/encryption';
import { getUserSupabase } from '@/lib/supabase-server';
import { checkKyc, parseKycPayload, type KycRecord } from '@/lib/kyc';

/**
 * Lender identity verification. Re-checks everything the form checked,
 * encrypts the ID numbers server-side, then files it as the user — the
 * database confirms the selfie and ID photos are files they uploaded.
 */
export async function POST(request: Request) {
  try {
    const { uid, email, token } = await verifyAuth(request);

    // Aadhaar numbers must never be stored under the built-in fallback key
    if (process.env.NODE_ENV === 'production' && !process.env.KYC_ENCRYPTION_KEY) {
      return NextResponse.json({ error: 'Verification is not configured on the server yet (KYC_ENCRYPTION_KEY is missing).' }, { status: 503 });
    }

    const payload = parseKycPayload(await request.json().catch(() => null));
    // The email on file is the one this account signed in with
    if (email) payload.personal.email = email.toLowerCase();

    const problem = checkKyc(payload, uid);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });

    const { identity } = payload;
    const record: KycRecord = {
      version: 2,
      personal: payload.personal,
      address: payload.address,
      identity: {
        idType: identity.idType,
        aadhaarNumber: encryptData(identity.aadhaarNumber),
        aadhaarLast4: identity.aadhaarNumber.slice(-4),
        idNumber: identity.idType !== 'aadhaar' && identity.idNumber ? encryptData(identity.idNumber) : null,
        panNumber: identity.panNumber ? encryptData(identity.panNumber) : null,
      },
      documents: payload.documents,
      consentAt: new Date().toISOString(),
    };

    const { error } = await getUserSupabase(token).rpc('submit_kyc', { p_data: record });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Verification failed' }, { status: 500 });
  }
}
