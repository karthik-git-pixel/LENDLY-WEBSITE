import { redirect } from 'next/navigation';

// Identity verification is part of the lender flow now
export default function KycPage() {
  redirect('/sell/verify');
}
