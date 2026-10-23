import { redirect } from 'next/navigation';

// The seller hub at /sell replaces the old dashboard
export default function SellerDashboardPage() {
  redirect('/sell');
}
