import 'server-only';
import OpenAI from 'openai';
import { CATEGORIES } from '@/lib/catalog';
import type { SnapResult } from './snap-types';

/**
 * Snap-to-List: one photo in, a filled-in rental listing out. Server only —
 * the OpenAI key never reaches the browser.
 */

const MODEL = process.env.OPENAI_SNAP_MODEL || 'gpt-6-luna';
const CATEGORY_NAMES = CATEGORIES.map(c => c.name);

const SYSTEM_PROMPT = `You are the listing helper for Lendly, a hyperlocal rental marketplace in India. A lender has photographed one item they want to rent out to neighbours; fill in the listing from the photo.

Rules:
- Prices are in INR and realistic for Kerala. Rent per day is what a local rental shop or neighbour would charge, not a share of the purchase price.
- Describe only what is visible. Never invent specs, model numbers or accessories you cannot see — use null for brand/model and leave arrays empty when unsure.
- title: short and searchable, max 60 characters, brand + item type when visible.
- description: 2–3 short plain sentences, no hype, no emojis.
- category must be one of the given values; subcategory should be one of that category's listed types, or "" if none fit.
- Deposit policy (suggested_deposit_inr): about 30% of estimated replacement value when the value is under ₹5,000; about 40% for ₹5,001–25,000; about 50% above ₹25,000. Round to a sensible figure.
- Set is_allowed=false, with a short polite rejection_reason, for weapons, drugs, alcohol, tobacco, ID documents, SIM cards, live animals or adult content. Otherwise is_allowed=true and rejection_reason=null.
- confidence (0–1) is how sure you are of the item identification and prices. Use low values for blurry photos or unclear items.

Categories and their types:
${CATEGORIES.map(c => `- ${c.name}: ${c.subcategories.join(', ') || '(none)'}`).join('\n')}`;

const nullableString = { type: ['string', 'null'] };
const stringList = { type: 'array', items: { type: 'string' } };

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'title', 'category', 'subcategory', 'brand', 'model', 'condition', 'visible_defects', 'description',
    'included_items', 'specs', 'estimated_replacement_value_inr', 'suggested_rent_per_day_inr',
    'suggested_sale_price_inr', 'suggested_deposit_inr', 'listing_type_hint', 'confidence', 'is_allowed', 'rejection_reason',
  ],
  properties: {
    title: { type: 'string', description: 'Max 60 characters' },
    category: { type: 'string', enum: CATEGORY_NAMES },
    subcategory: { type: 'string' },
    brand: nullableString,
    model: nullableString,
    condition: { type: 'string', enum: ['like_new', 'good', 'used', 'has_defects'] },
    visible_defects: stringList,
    description: { type: 'string', description: '2–3 short, plain sentences' },
    included_items: { ...stringList, description: 'Accessories visible in the photo' },
    specs: {
      type: 'array',
      maxItems: 6,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['key', 'value'],
        properties: { key: { type: 'string' }, value: { type: 'string' } },
      },
    },
    estimated_replacement_value_inr: { type: 'number' },
    suggested_rent_per_day_inr: { type: 'number' },
    suggested_sale_price_inr: { type: 'number' },
    suggested_deposit_inr: { type: 'number' },
    listing_type_hint: { type: 'string', enum: ['rent', 'sell', 'both'] },
    confidence: { type: 'number', description: '0 to 1' },
    is_allowed: { type: 'boolean' },
    rejection_reason: nullableString,
  },
} as const;

const MOCK_RESULT: SnapResult = {
  title: 'JBL PartyBox 310 Bluetooth Party Speaker',
  category: 'Event & Sound',
  subcategory: 'Sound & DJ',
  brand: 'JBL',
  model: 'PartyBox 310',
  condition: 'good',
  visible_defects: ['Light scuffs on the top handle'],
  description: 'Portable JBL PartyBox speaker with built-in lights and a telescopic handle with wheels. Loud enough for a house party or a small hall. Minor scuffs on the handle, otherwise clean.',
  included_items: ['Power cable', 'Wired microphone'],
  specs: [
    { key: 'Output', value: '240 W' },
    { key: 'Battery', value: 'Up to 18 hours' },
    { key: 'Connectivity', value: 'Bluetooth, AUX, USB' },
  ],
  estimated_replacement_value_inr: 38000,
  suggested_rent_per_day_inr: 900,
  suggested_sale_price_inr: 22000,
  suggested_deposit_inr: 19000,
  listing_type_hint: 'rent',
  confidence: 0.86,
  is_allowed: true,
  rejection_reason: null,
};

let client: OpenAI | null = null;

export const snapMockMode = () => process.env.AI_MOCK === 'true';
export const snapConfigured = () => snapMockMode() || Boolean(process.env.OPENAI_API_KEY);

const money = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.round(n) : 0);
const text = (s: unknown, max: number) => (typeof s === 'string' ? s.trim().slice(0, max) : '');
const list = (a: unknown, max: number) =>
  (Array.isArray(a) ? a : []).map(x => text(x, 60)).filter(Boolean).slice(0, max);

/** Keeps the model's answer inside what the form can hold, whatever it sent */
function tidy(raw: SnapResult): SnapResult {
  const category = CATEGORIES.find(c => c.name === raw.category) || CATEGORIES.find(c => c.id === 'other')!;
  const subcategory = category.subcategories.find(s => s.toLowerCase() === String(raw.subcategory || '').toLowerCase()) || '';
  const conditions: SnapResult['condition'][] = ['like_new', 'good', 'used', 'has_defects'];
  return {
    title: text(raw.title, 60),
    category: category.name,
    subcategory,
    brand: text(raw.brand, 40) || null,
    model: text(raw.model, 60) || null,
    condition: conditions.includes(raw.condition) ? raw.condition : 'used',
    visible_defects: list(raw.visible_defects, 6),
    description: text(raw.description, 600),
    included_items: list(raw.included_items, 10),
    specs: (Array.isArray(raw.specs) ? raw.specs : [])
      .map(s => ({ key: text(s?.key, 30), value: text(s?.value, 60) }))
      .filter(s => s.key && s.value)
      .slice(0, 6),
    estimated_replacement_value_inr: money(raw.estimated_replacement_value_inr),
    suggested_rent_per_day_inr: money(raw.suggested_rent_per_day_inr),
    suggested_sale_price_inr: money(raw.suggested_sale_price_inr),
    suggested_deposit_inr: money(raw.suggested_deposit_inr),
    listing_type_hint: raw.listing_type_hint === 'sell' || raw.listing_type_hint === 'both' ? raw.listing_type_hint : 'rent',
    confidence: Math.min(1, Math.max(0, Number(raw.confidence) || 0)),
    is_allowed: raw.is_allowed !== false,
    rejection_reason: raw.is_allowed === false ? text(raw.rejection_reason, 200) || 'This item can’t be listed on Lendly.' : null,
  };
}

/** Reads one photo and drafts the listing. Throws if the model call fails. */
export async function snapToList(image: { base64: string; mimeType: string }): Promise<SnapResult> {
  if (snapMockMode()) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.info('[snap-to-list] model=mock input_tokens=0 output_tokens=0');
    return MOCK_RESULT;
  }

  client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.create({
    model: MODEL,
    // Counts the model's reasoning too: a plain bag used ~480, so 600 cut richer items short
    max_output_tokens: 2000,
    instructions: SYSTEM_PROMPT,
    input: [{
      role: 'user',
      content: [
        { type: 'input_text', text: 'Draft a rental listing for the item in this photo.' },
        { type: 'input_image', image_url: `data:${image.mimeType};base64,${image.base64}`, detail: 'low' },
      ],
    }],
    text: { format: { type: 'json_schema', name: 'snap_to_list', strict: true, schema: SCHEMA } },
  });

  const usage = response.usage;
  console.info(`[snap-to-list] model=${response.model || MODEL} input_tokens=${usage?.input_tokens ?? '?'} output_tokens=${usage?.output_tokens ?? '?'}`);

  if (response.status === 'incomplete') throw new Error(`Response incomplete: ${response.incomplete_details?.reason || 'unknown'}`);
  return tidy(JSON.parse(response.output_text) as SnapResult);
}
