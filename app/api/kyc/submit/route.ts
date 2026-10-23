import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/verify-auth';
import { encryptData } from '@/lib/encryption';
import { getUserSupabase } from '@/lib/supabase-server';

/** Encrypts the sensitive KYC fields server-side, then files them as the user */
export async function POST(request: Request) {
  try {
    const { token } = await verifyAuth(request);
    const payload = await request.json();

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

    const encrypted = {
      personal: payload.personal,
      address: payload.address,
      identity: {
        ...payload.identity,
        panNumber: encryptData(payload.identity.panNumber),
        governmentIdNumber: payload.identity.governmentIdNumber ? encryptData(payload.identity.governmentIdNumber) : null,
      },
      bank: { ...payload.bank, accountNumber: encryptData(payload.bank.accountNumber) },
      business: payload.business ? { ...payload.business, businessPan: payload.business.businessPan ? encryptData(payload.business.businessPan) : null } : null,
    };

    const { error } = await getUserSupabase(token).rpc('submit_kyc', { p_data: encrypted });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ success: true, message: 'KYC application submitted securely' });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'KYC submission failed' }, { status: 500 });
  }
}
