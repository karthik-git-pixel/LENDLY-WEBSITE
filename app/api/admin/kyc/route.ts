import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/verify-auth';
import { decryptData } from '@/lib/encryption';
import { getUserSupabase } from '@/lib/supabase-server';
import { idTypeInfo, type KycRecord } from '@/lib/kyc';

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
  data: KycRecord & {
    /** Older (v1) submissions */
    bank?: { accountHolder?: string; accountNumber?: string; ifsc?: string };
    business?: { businessName?: string; businessPan?: string | null; gstin?: string } | null;
  };
}

export async function GET(request: Request) {
  try {
    const db = await adminClient(request);
    const { data, error } = await db.rpc('admin_list_kyc');
    if (error) return NextResponse.json({ error: error.message }, { status: 403 });
    const rows = (data || []) as KycRow[];

    // Ten-minute links to the private selfie and ID photos (storage lets admins read them)
    const paths = rows.flatMap(r => [r.data.documents?.selfie, r.data.documents?.idFront, r.data.documents?.idBack])
      .filter((p): p is string => Boolean(p));
    const signed = paths.length ? (await db.storage.from('kyc-docs').createSignedUrls(paths, 600)).data || [] : [];
    const urlFor = new Map(signed.filter(s => s.signedUrl).map(s => [s.path, s.signedUrl]));
    const doc = (path?: string) => (path ? { url: urlFor.get(path) || null, isPdf: /\.pdf$/i.test(path) } : null);

    const applications = rows.map(row => {
      const { personal, address, identity, documents } = row.data;
      const aadhaar = identity?.aadhaarNumber || identity?.governmentIdNumber;
      return {
        uid: row.user_id,
        email: personal?.email || row.email,
        displayName: row.display_name,
        submittedAt: row.submitted_at,
        personal: {
          fullName: personal?.fullName || row.display_name,
          phone: personal?.phone || '',
          dob: personal?.dob || '',
        },
        address: address
          ? [address.line || address.address, address.city || address.district, address.state].filter(Boolean).join(', ') + (address.pinCode ? ` – ${address.pinCode}` : '')
          : '',
        identity: {
          idType: identity?.idType ? idTypeInfo(identity.idType).label : 'Not given',
          aadhaarMasked: identity?.aadhaarLast4 ? `•••• •••• ${identity.aadhaarLast4}` : aadhaar ? maskString(decryptData(aadhaar)) : 'N/A',
          idNumberMasked: identity?.idNumber ? maskString(decryptData(identity.idNumber)) : null,
          panMasked: identity?.panNumber ? maskString(decryptData(identity.panNumber)) : null,
        },
        documents: { selfie: doc(documents?.selfie), idFront: doc(documents?.idFront), idBack: doc(documents?.idBack) },
        bank: row.data.bank ? {
          accountHolder: row.data.bank.accountHolder || '',
          accountNumberMasked: maskString(decryptData(row.data.bank.accountNumber || '')),
          ifsc: row.data.bank.ifsc || '',
        } : null,
        business: row.data.business ? {
          businessName: row.data.business.businessName || '',
          businessPanMasked: row.data.business.businessPan ? maskString(decryptData(row.data.business.businessPan)) : 'N/A',
          gstin: row.data.business.gstin || '',
        } : null,
      };
    });
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
