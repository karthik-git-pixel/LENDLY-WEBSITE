import { redirect } from 'next/navigation';

// Becoming a lender is verify → set up shop → list, starting here
export default function BecomeSellerPage() {
  redirect('/sell/onboarding');
}
