/** What Snap-to-List sends back for one photo; shared by the API route and the listing form */
export interface SnapResult {
  title: string;
  category: string;
  subcategory: string;
  brand: string | null;
  model: string | null;
  condition: 'like_new' | 'good' | 'used' | 'has_defects';
  visible_defects: string[];
  description: string;
  included_items: string[];
  specs: { key: string; value: string }[];
  estimated_replacement_value_inr: number;
  suggested_rent_per_day_inr: number;
  suggested_sale_price_inr: number;
  suggested_deposit_inr: number;
  listing_type_hint: 'rent' | 'sell' | 'both';
  confidence: number;
  is_allowed: boolean;
  rejection_reason: string | null;
}

export type SnapResponse = { fallback: false; result: SnapResult } | { fallback: true; error?: string };

/** Largest photo the route accepts */
export const SNAP_MAX_BYTES = 8 * 1024 * 1024;
