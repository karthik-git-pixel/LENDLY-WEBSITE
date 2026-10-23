import type { UserProfile } from './supabase-db';

/**
 * Lender identity verification. The verification form and /api/kyc/submit
 * both use these checks, so the browser and the server agree on the rules.
 */

/**
 * Prototype mode (the default for now): any details are accepted — fields
 * only have to be filled in, and Aadhaar, phone, PIN, PAN and age aren't
 * checked. Set NEXT_PUBLIC_KYC_STRICT=true to turn the real rules on.
 */
export const KYC_STRICT = process.env.NEXT_PUBLIC_KYC_STRICT === 'true';

/** Verification sent for review (or already approved) — enough to run a shop */
export function kycSubmitted(profile: Pick<UserProfile, 'kycStatus'> | null | undefined): boolean {
  return profile?.kycStatus === 'PENDING_VERIFICATION' || profile?.kycStatus === 'VERIFIED';
}

/** A shop renters can find: switched on, named, with a pickup point */
export function shopReady(profile: Pick<UserProfile, 'isSeller' | 'storeName' | 'storeLocation'> | null | undefined): boolean {
  const at = profile?.storeLocation;
  return Boolean(profile?.isSeller && profile.storeName?.trim() && at && (at.lat !== 0 || at.lng !== 0));
}

export const ID_TYPES = [
  { id: 'aadhaar', label: 'Aadhaar card', front: 'Front', back: 'Back' },
  { id: 'driving_licence', label: 'Driving licence', front: 'Front', back: 'Back' },
  { id: 'voter_id', label: 'Voter ID', front: 'Front', back: 'Back' },
  { id: 'passport', label: 'Passport', front: 'Photo page', back: 'Address page' },
  { id: 'pan', label: 'PAN card', front: 'Front', back: null },
] as const satisfies readonly { id: string; label: string; front: string; back: string | null }[];

export type IdType = (typeof ID_TYPES)[number]['id'];

export function idTypeInfo(id: string) {
  return ID_TYPES.find(t => t.id === id) ?? ID_TYPES[0];
}

export const INDIAN_STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh',
  'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep',
  'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Puducherry',
  'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
  'West Bengal',
];

const digitsOf = (value: string) => value.replace(/\D/g, '');

// Aadhaar's last digit is a Verhoeff checksum, which catches typos and swapped digits
const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

export function isValidAadhaar(value: string): boolean {
  const n = digitsOf(value);
  // 12 digits, never starting with 0 or 1
  if (!/^[2-9]\d{11}$/.test(n)) return false;
  let check = 0;
  for (let i = 0; i < n.length; i++) {
    check = VERHOEFF_D[check][VERHOEFF_P[i % 8][Number(n[n.length - 1 - i])]];
  }
  return check === 0;
}

/** "234123412346" → "2341 2341 2346" */
export function formatAadhaar(value: string): string {
  return digitsOf(value).slice(0, 12).replace(/(\d{4})(?=\d)/g, '$1 ');
}

export const isValidPan = (value: string) => /^[A-Z]{5}\d{4}[A-Z]$/.test(value.trim().toUpperCase());
export const isValidPin = (value: string) => /^[1-9]\d{5}$/.test(value.trim());
export const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());

/** Ten-digit Indian mobile, with or without +91 */
export function normalizeMobile(value: string): string {
  const n = digitsOf(value);
  return n.length === 12 && n.startsWith('91') ? n.slice(2) : n;
}

export const isValidMobile = (value: string) => /^[6-9]\d{9}$/.test(normalizeMobile(value));

/** Whole years since a YYYY-MM-DD date of birth; null when it isn't a real date */
export function ageFrom(dob: string, today: Date = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const birth = new Date(Date.UTC(year, month - 1, day));
  if (birth.getUTCMonth() !== month - 1 || birth.getUTCDate() !== day) return null; // 2001-02-30
  let age = today.getFullYear() - year;
  const beforeBirthday = today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day);
  if (beforeBirthday) age -= 1;
  return age;
}

/** "••••  ••••  1234" */
export function maskAadhaar(last4: string | null | undefined): string {
  return last4 ? `•••• •••• ${last4}` : '—';
}

// --------------------------------------------------------------------
// What the form sends to /api/kyc/submit
// --------------------------------------------------------------------

export interface KycPayload {
  personal: { fullName: string; email: string; phone: string; dob: string };
  address: { line: string; city: string; state: string; pinCode: string };
  identity: { aadhaarNumber: string; idType: IdType; idNumber?: string; panNumber?: string };
  /** Object paths in the private kyc-docs bucket */
  documents: { selfie: string; idFront: string; idBack?: string };
  consent: boolean;
}

/** What's stored in kyc_submissions.data (sensitive numbers encrypted by the server) */
export interface KycRecord {
  version?: number;
  personal?: { fullName?: string; email?: string; phone?: string; dob?: string };
  address?: { line?: string; city?: string; state?: string; pinCode?: string; address?: string; district?: string };
  identity?: {
    idType?: string;
    aadhaarNumber?: string;
    aadhaarLast4?: string;
    idNumber?: string | null;
    panNumber?: string | null;
    /** Older submissions */
    governmentIdNumber?: string | null;
  };
  documents?: { selfie?: string; idFront?: string; idBack?: string };
  consentAt?: string;
}

export function checkPersonal(p: KycPayload['personal'], strict = KYC_STRICT): string | null {
  if (!strict) {
    if (!p.fullName.trim()) return 'Enter your full name';
    if (!p.email.trim()) return 'Enter your email';
    if (!p.phone.trim()) return 'Enter your mobile number';
    if (!p.dob.trim()) return 'Enter your date of birth';
    return null;
  }
  if (p.fullName.trim().length < 3) return 'Enter your full name as it appears on your ID';
  if (!isValidEmail(p.email)) return 'Enter a valid email address';
  if (!isValidMobile(p.phone)) return 'Enter a valid 10-digit mobile number';
  const age = ageFrom(p.dob);
  if (age === null) return 'Enter your date of birth';
  if (age < 18) return 'You need to be 18 or older to rent out on Lendly';
  if (age > 120) return 'Check your date of birth';
  return null;
}

export function checkAddress(a: KycPayload['address'], strict = KYC_STRICT): string | null {
  if (!strict) {
    if (!a.line.trim()) return 'Enter your address';
    if (!a.city.trim()) return 'Enter your city or town';
    if (!a.state.trim()) return 'Choose your state';
    if (!a.pinCode.trim()) return 'Enter your PIN code';
    return null;
  }
  if (a.line.trim().length < 5) return 'Enter your house and street address';
  if (a.city.trim().length < 2) return 'Enter your city or town';
  if (!INDIAN_STATES.includes(a.state)) return 'Choose your state';
  if (!isValidPin(a.pinCode)) return 'Enter a valid 6-digit PIN code';
  return null;
}

export function checkIdentity(i: KycPayload['identity'], strict = KYC_STRICT): string | null {
  if (!strict) {
    if (!digitsOf(i.aadhaarNumber)) return 'Enter your Aadhaar number';
    return ID_TYPES.some(t => t.id === i.idType) ? null : 'Choose which ID you\'re uploading';
  }
  if (digitsOf(i.aadhaarNumber).length !== 12) return 'Enter your 12-digit Aadhaar number';
  if (!isValidAadhaar(i.aadhaarNumber)) return 'That Aadhaar number doesn\'t look right — check the digits';
  if (!ID_TYPES.some(t => t.id === i.idType)) return 'Choose which ID you\'re uploading';
  if (i.idType !== 'aadhaar' && (i.idNumber || '').trim().length < 5) return `Enter your ${idTypeInfo(i.idType).label} number`;
  if (i.panNumber && !isValidPan(i.panNumber)) return 'That PAN doesn\'t look right (format: ABCDE1234F)';
  return null;
}

/**
 * Every required photo is there. With `owner`, each must also be a path
 * inside that user's own folder of the kyc-docs bucket.
 */
export function checkDocuments(
  docs: { selfie?: unknown; idFront?: unknown; idBack?: unknown },
  idType: IdType,
  owner?: string
): string | null {
  const ok = (v: unknown) => (owner ? typeof v === 'string' && v.startsWith(`${owner}/`) && !v.includes('..') : Boolean(v));
  const id = idTypeInfo(idType);
  if (!ok(docs.idFront)) return `Add a photo of your ${id.label} (${id.front.toLowerCase()})`;
  if (id.back && !ok(docs.idBack)) return `Add a photo of your ${id.label} (${id.back.toLowerCase()})`;
  if (!ok(docs.selfie)) return 'Take a selfie';
  return null;
}

export function checkKyc(p: KycPayload, owner?: string, strict = KYC_STRICT): string | null {
  return checkPersonal(p.personal, strict)
    ?? checkAddress(p.address, strict)
    ?? checkIdentity(p.identity, strict)
    ?? checkDocuments(p.documents, p.identity.idType, owner)
    ?? (p.consent ? null : 'Please confirm your consent to submit');
}

/** Builds a payload from untrusted JSON: trimmed strings only, capped in length */
export function parseKycPayload(raw: unknown): KycPayload {
  const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});
  const str = (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, 200) : '');
  const body = obj(raw);
  const personal = obj(body.personal);
  const address = obj(body.address);
  const identity = obj(body.identity);
  const documents = obj(body.documents);
  return {
    personal: {
      fullName: str(personal.fullName).replace(/\s+/g, ' '),
      email: str(personal.email).toLowerCase(),
      phone: normalizeMobile(str(personal.phone)),
      dob: str(personal.dob),
    },
    address: {
      line: str(address.line),
      city: str(address.city),
      state: str(address.state),
      pinCode: digitsOf(str(address.pinCode)),
    },
    identity: {
      aadhaarNumber: digitsOf(str(identity.aadhaarNumber)),
      idType: str(identity.idType) as IdType,
      idNumber: str(identity.idNumber).toUpperCase() || undefined,
      panNumber: str(identity.panNumber).toUpperCase() || undefined,
    },
    documents: {
      selfie: str(documents.selfie),
      idFront: str(documents.idFront),
      idBack: str(documents.idBack) || undefined,
    },
    consent: body.consent === true,
  };
}
