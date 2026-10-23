import { redirect } from 'next/navigation';

export default function ShopsPage() {
  redirect('/search?tab=shops');
}
