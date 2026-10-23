import { redirect } from 'next/navigation';

// QR codes live on each booking now
export default function QRListPage() {
  redirect('/profile/orders');
}
