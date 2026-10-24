import { redirect } from 'next/navigation';

// The seller hub at /sell?tab=orders hosts the QR scanner & customer booking approvals
export default function SellerDashboardPage() {
  redirect('/sell?tab=orders');
}
