import { SUBCATEGORY_SPEC, rentFeatureOptions } from '@/lib/catalog';
import type { SnapResult } from './snap-types';

/** Listing-form fields Snap-to-List can fill; each shows a "✨ AI" tag until edited */
export type AiField = 'title' | 'category' | 'subcategory' | 'description' | 'price' | 'deposit' | 'features' | 'spec';

const CONDITION_LABEL: Record<SnapResult['condition'], string> = {
  like_new: 'Like new',
  good: 'Good',
  used: 'Used, works fine',
  has_defects: 'Has some defects',
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Turns the AI's answer into the rental form's values */
export function draftFromSnap(r: SnapResult) {
  const featureOptions = rentFeatureOptions(r.subcategory);
  // Accessories the form has a chip for get ticked; the rest go into the description
  const features = featureOptions.filter(f => r.included_items.some(i => norm(i).includes(norm(f)) || norm(f).includes(norm(i))));
  const leftover = r.included_items.filter(i => !features.some(f => norm(i).includes(norm(f)) || norm(f).includes(norm(i))));

  // The form asks for one spec per type, e.g. "Total power" for speakers
  const specField = SUBCATEGORY_SPEC[r.subcategory];
  const specMatch = specField && r.specs.find(s => [specField.key, specField.label].some(k => norm(s.key).includes(norm(k)) || norm(k).includes(norm(s.key))));
  const otherSpecs = r.specs.filter(s => s !== specMatch);

  const lines = [
    r.description,
    '',
    `Condition: ${CONDITION_LABEL[r.condition]}${r.visible_defects.length ? ` — ${r.visible_defects.join('; ')}` : ''}.`,
    leftover.length ? `Included: ${leftover.join(', ')}.` : '',
    otherSpecs.length ? otherSpecs.map(s => `${s.key}: ${s.value}`).join(' · ') : '',
  ].filter((line, i) => i === 1 || line);

  return {
    title: r.title,
    description: lines.join('\n').trim(),
    category: r.category,
    subcategory: r.subcategory,
    price: r.suggested_rent_per_day_inr > 0 ? String(r.suggested_rent_per_day_inr) : '',
    deposit: r.suggested_deposit_inr > 0 ? String(r.suggested_deposit_inr) : '',
    features,
    spec: specMatch ? specMatch.value : '',
    fields: new Set<AiField>([
      'title', 'category', 'description',
      ...(r.subcategory ? ['subcategory' as const] : []),
      ...(r.suggested_rent_per_day_inr > 0 ? ['price' as const] : []),
      ...(r.suggested_deposit_inr > 0 ? ['deposit' as const] : []),
      ...(features.length ? ['features' as const] : []),
      ...(specMatch ? ['spec' as const] : []),
    ]),
  };
}

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

/** One line on how the suggested rent and deposit were reached */
export function whyThisPrice(r: SnapResult): string {
  const value = r.estimated_replacement_value_inr;
  if (!value) return 'Based on what similar items rent for around Kerala.';
  const share = value <= 5000 ? '30%' : value <= 25000 ? '40%' : '50%';
  return `A new one costs about ${inr(value)}. Similar rentals nearby go for around ${inr(r.suggested_rent_per_day_inr)}/day, and the deposit is about ${share} of the item's value, per Lendly's deposit guide.`;
}

export { inr };
