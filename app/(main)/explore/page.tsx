import { redirect } from 'next/navigation';

// The map lives on the search page now (Shops | Products with a live map)
export default function ExplorePage() {
  redirect('/search?tab=shops');
}
