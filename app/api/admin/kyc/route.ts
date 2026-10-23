import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/verify-auth';
import { decryptData } from '@/lib/encryption';
import { getUserSupabase } from '@/lib/supabase-server';

const maskString = (str: string | null | undefined, showLast = 4) => {
  if (!str) return 'N/A';
  if (str === 'ENCRYPTION_ERROR') return 'DECRYPTION FAILED';
  if (str.length <= showLast) return str;
  return '*'.repeat(str.length - showLast) + str.slice(-showLast);
};

/**
 * Admins are accounts with profiles.is_admin = true (set it in the SQL editor).
 * ADMIN_EMAILS, when set, must also include the admin's email.
 */
async function adminClient(request: Request) {
  const { email, token } = await verifyAuth(request);
  const adminEmails = (process.env.ADMIN_EMAILS || 'admin@radiuscart.com').split(',').map(e => e.trim());
  if (process.env.ADMIN_EMAILS && (!email || !adminEmails.includes(email))) {
    throw NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
  }
  return getUserSupabase(token);
}

interface KycRow {
  user_id: string;
  email: string;
  display_name: string;
  kyc_status: string;
  submitted_at: string;
  data: {
    personal?: unknown;
    address?: unknown;
    identity?: { panNumber?: string; governmentIdNumber?: string | null };
    bank?: { accountHolder?: string; accountNumber?: string; ifsc?: string };
    business?: { businessName?: string; businessPan?: string | null; gstin?: string } | null;
  };
}

export async function GET(request: Request) {
  try {
    const db = await adminClient(request);
    const { data, error } = await db.rpc('admin_list_kyc');
    if (error) return NextResponse.json({ error: error.message }, { status: 403 });

    const applications = ((data || []) as KycRow[]).map(row => ({
      uid: row.user_id,
      email: row.email,
      displayName: row.display_name,
      kycStatus: row.kyc_status,
      kycData: {
        personal: row.data.personal,
        address: row.data.address,
        identity: {
          panNumberMasked: maskString(decryptData(row.data.identity?.panNumber || '')),
          governmentIdMasked: row.data.identity?.governmentIdNumber ? maskString(decryptData(row.data.identity.governmentIdNumber)) : 'N/A',
        },
        bank: {
          accountHolder: row.data.bank?.accountHolder,
          accountNumberMasked: maskString(decryptData(row.data.bank?.accountNumber || '')),
          ifsc: row.data.bank?.ifsc,
        },
        business: row.data.business ? {
          businessName: row.data.business.businessName,
          businessPanMasked: row.data.business.businessPan ? maskString(decryptData(row.data.business.businessPan)) : 'N/A',
          gstin: row.data.business.gstin,
        } : null,
        submittedAt: row.submitted_at,
      },
    }));
    return NextResponse.json({ applications });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await adminClient(request);
    const { targetUid, action, reason } = await request.json();
    if (!targetUid || !['APPROVE', 'REJECT'].includes(action)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }
    const { error } = await db.rpc('admin_review_kyc', { p_user_id: targetUid, p_approve: action === 'APPROVE', p_reason: reason || '' });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
