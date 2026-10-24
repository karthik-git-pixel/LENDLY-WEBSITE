import { SUBCATEGORY_SPEC, rentFeatureOptions } from '@/lib/catalog';
import type { SnapResult } from './snap-types';

const CONDITION_LABEL: Record<SnapResult['condition'], string> = {
  like_new: 'Like new',
  good: 'Good',
  used: 'Used, works fine',
  has_defects: 'Has some defects',
};

const SPECS_HEADING = 'Specifications:';

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const matches = (a: string, b: string) => norm(a).includes(norm(b)) || norm(b).includes(norm(a));

/** Swaps the "Specifications:" block at the end of a description for a fresh one */
export function withSpecs(description: string, specs: SnapResult['specs']): string {
  const head = description.split(SPECS_HEADING)[0].trimEnd();
  if (!specs.length) return head;
  return `${head}${head ? '\n\n' : ''}${SPECS_HEADING}\n${specs.map(s => `• ${s.key}: ${s.value}`).join('\n')}`;
}

/** Turns the AI's answer into the rental form's values */
export function draftFromSnap(r: SnapResult, fromPhoto: boolean) {
  const featureOptions = rentFeatureOptions(r.subcategory);
  // Accessories the form has a chip for get ticked; the rest go into the description
  const features = featureOptions.filter(f => r.included_items.some(i => matches(i, f)));
  const leftover = r.included_items.filter(i => !features.some(f => matches(i, f)));

  // The form asks for one spec per type, e.g. "Total power" for speakers
  const specField = SUBCATEGORY_SPEC[r.subcategory];
  const specMatch = specField && r.specs.find(s => matches(s.key, specField.key) || matches(s.key, specField.label));

  const body = [
    r.description,
    fromPhoto ? `Condition: ${CONDITION_LABEL[r.condition]}${r.visible_defects.length ? ` — ${r.visible_defects.join('; ')}` : ''}.` : '',
    leftover.length ? `Included: ${leftover.join(', ')}.` : '',
  ].filter(Boolean).join('\n\n');

  return {
    title: r.title,
    description: withSpecs(body, r.specs),
    category: r.category,
    subcategory: r.subcategory,
    model: [r.brand, r.model].filter(Boolean).join(' '),
    price: r.suggested_rent_per_day_inr > 0 ? String(r.suggested_rent_per_day_inr) : '',
    deposit: r.suggested_deposit_inr > 0 ? String(r.suggested_deposit_inr) : '',
    features,
    spec: specMatch ? specMatch.value : '',
  };
}
