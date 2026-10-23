import {
  Armchair,
  BookOpen,
  Building2,
  Camera,
  Car,
  Dumbbell,
  Landmark,
  LayoutGrid,
  Lightbulb,
  Monitor,
  Package,
  Printer,
  Projector,
  Shirt,
  Sparkles,
  Speaker,
  Tent,
  UtensilsCrossed,
  Wrench,
  Hammer,
  Zap,
  type LucideIcon,
} from 'lucide-react';

export type ListingType = 'sale' | 'rent';
export type RentUnit = 'hour' | 'day' | 'week' | 'month';

export interface Category {
  /** URL-safe id used in ?category= */
  id: string;
  /** Value stored in products.category */
  name: string;
  icon: LucideIcon;
  subcategories: string[];
  /** Legacy or colloquial names that should land in this category */
  aliases: string[];
  /** Rentals-first categories lead the rail when the Rent view is on */
  rentFirst?: boolean;
}

export const CATEGORIES: Category[] = [
  {
    id: 'electronics',
    name: 'Electronics',
    icon: Monitor,
    subcategories: ['Mobiles & Tablets', 'Laptops & Computers', 'Cameras & Lenses', 'TV & Audio', 'Gaming', 'Appliances'],
    aliases: ['mobile', 'phone', 'tablet', 'laptop', 'computer', 'camera', 'gadget', 'appliance', 'electr'],
  },
  {
    id: 'event-sound',
    name: 'Event & Sound',
    icon: Speaker,
    subcategories: [
      'Halls & Venues',
      'Sound & DJ',
      'Lighting',
      'Stage & Decor',
      'Tents & Pandal',
      'Chairs & Tables',
      'Catering Equipment',
      'Generators & Power',
      'Projectors & Screens',
      'Photo & Video',
    ],
    aliases: ['event', 'sound', 'speaker', 'dj', 'hall', 'venue', 'auditorium', 'light', 'stage', 'decor', 'tent', 'pandal', 'shamiana', 'generator', 'projector', 'mic', 'party'],
    rentFirst: true,
  },
  {
    id: 'vehicles',
    name: 'Vehicles',
    icon: Car,
    subcategories: ['Cars', 'Bikes & Scooters', 'Bicycles', 'Commercial'],
    aliases: ['car', 'bike', 'scooter', 'cycle', 'vehicle', 'auto', 'motorcycle', 'commercial', 'truck'],
    rentFirst: true,
  },
  {
    id: 'furniture',
    name: 'Furniture',
    icon: Armchair,
    subcategories: ['Beds & Mattresses', 'Sofas & Chairs', 'Tables & Desks', 'Storage', 'Home Decor'],
    aliases: ['furnit', 'sofa', 'chair', 'table', 'bed', 'decor', 'wardrobe'],
  },
  {
    id: 'books',
    name: 'Books',
    icon: BookOpen,
    subcategories: ['Textbooks', 'Exam Prep', 'Novels', 'Stationery'],
    aliases: ['book', 'stationery', 'textbook', 'novel', 'notes'],
  },
  {
    id: 'fashion',
    name: 'Fashion',
    icon: Shirt,
    subcategories: ['Men', 'Women', 'Ethnic & Occasion', 'Footwear', 'Accessories'],
    aliases: ['fashion', 'cloth', 'wear', 'dress', 'shoe', 'saree', 'sherwani', 'lehenga'],
  },
  {
    id: 'properties',
    name: 'Properties',
    icon: Building2,
    subcategories: ['Rooms & PG', 'Flats & Houses', 'Shops & Offices', 'Land'],
    aliases: ['propert', 'room', 'pg', 'flat', 'house', 'apartment', 'real estate', 'office'],
    rentFirst: true,
  },
  {
    id: 'tools',
    name: 'Tools & DIY',
    icon: Hammer,
    subcategories: ['Power Tools', 'Ladders & Access', 'Gardening', 'Cleaning'],
    aliases: ['tool', 'drill', 'ladder', 'garden', 'diy', 'cleaning'],
    rentFirst: true,
  },
  {
    id: 'sports',
    name: 'Sports & Outdoor',
    icon: Dumbbell,
    subcategories: ['Fitness', 'Camping & Trekking', 'Cycling', 'Games'],
    aliases: ['sport', 'fitness', 'gym', 'camping', 'trek', 'tent', 'game'],
  },
  {
    id: 'services',
    name: 'Services',
    icon: Wrench,
    subcategories: ['Repairs', 'Tutoring', 'Photography', 'Moving & Delivery', 'Cleaning'],
    aliases: ['service', 'repair', 'tutor', 'job', 'gig'],
  },
  {
    id: 'other',
    name: 'Other',
    icon: Package,
    subcategories: [],
    aliases: ['other', 'misc', 'food', 'pet'],
  },
];

/** The category rail: "All", the catalogue, and Print & Xerox as a shortcut */
export interface RailItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href?: string;
}

export const ALL_RAIL_ITEM: RailItem = { id: 'all', label: 'All', icon: LayoutGrid };
export const PRINT_RAIL_ITEM: RailItem = { id: 'print', label: 'Print & Xerox', icon: Printer, href: '/print' };

export function railItems(view: 'all' | ListingType): RailItem[] {
  const ordered = view === 'rent'
    ? [...CATEGORIES.filter(c => c.rentFirst), ...CATEGORIES.filter(c => !c.rentFirst)]
    : CATEGORIES;
  return [
    ALL_RAIL_ITEM,
    ...ordered.filter(c => c.id !== 'other').map(c => ({ id: c.id, label: c.name, icon: c.icon })),
    PRINT_RAIL_ITEM,
  ];
}

export function getCategory(idOrName: string | null | undefined): Category | undefined {
  if (!idOrName) return undefined;
  const key = idOrName.toLowerCase();
  return CATEGORIES.find(c => c.id === key || c.name.toLowerCase() === key);
}

/**
 * Which catalogue category a listing belongs to. Exact names win; older
 * free-text categories ("Mobiles", "Clothing") fall back to keyword aliases.
 */
export function resolveCategory(category: string | null | undefined, subcategory?: string | null): Category {
  const exact = getCategory(category ?? '');
  if (exact) return exact;
  if (subcategory) {
    const bySub = CATEGORIES.find(c => c.subcategories.some(s => s.toLowerCase() === subcategory.toLowerCase()));
    if (bySub) return bySub;
  }
  const text = `${category ?? ''} ${subcategory ?? ''}`.toLowerCase();
  return CATEGORIES.find(c => c.aliases.some(a => text.includes(a))) ?? CATEGORIES[CATEGORIES.length - 1];
}

export function matchesCategory(
  product: { category?: string; subcategory?: string },
  categoryId: string
): boolean {
  if (!categoryId || categoryId === 'all') return true;
  return resolveCategory(product.category, product.subcategory).id === categoryId;
}

// --------------------------------------------------------------------
// Rentals
// --------------------------------------------------------------------

export const RENT_UNITS: { id: RentUnit; label: string; short: string; hours: number }[] = [
  { id: 'hour', label: 'Per hour', short: 'hr', hours: 1 },
  { id: 'day', label: 'Per day', short: 'day', hours: 24 },
  { id: 'week', label: 'Per week', short: 'week', hours: 168 },
  { id: 'month', label: 'Per month', short: 'month', hours: 720 },
];

export function rentUnitInfo(unit: string | null | undefined) {
  return RENT_UNITS.find(u => u.id === unit) ?? RENT_UNITS[1];
}

/** "₹500/day" for rentals, "₹12,000" for sales */
export function formatPrice(price: number, listingType?: string, unit?: string | null): string {
  const amount = `₹${Math.round(price).toLocaleString('en-IN')}`;
  return listingType === 'rent' ? `${amount}/${rentUnitInfo(unit).short}` : amount;
}

export function pluralUnit(unit: string | null | undefined, count: number): string {
  const short = rentUnitInfo(unit).short;
  const word = short === 'hr' ? 'hour' : short;
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

export const SALE_CONDITIONS = ['New', 'Like new', 'Good', 'Fair', 'For parts'];

/** Tag chips offered on the rent form; subcategory extras come first */
const COMMON_RENT_FEATURES = ['Delivery available', 'Pickup only', 'Setup included', 'Operator included'];

const SUBCATEGORY_FEATURES: Record<string, string[]> = {
  'Halls & Venues': ['AC', 'Parking', 'Stage', 'Kitchen', 'Dining area', 'Power backup', 'Rooms for guests', 'Wheelchair access'],
  'Sound & DJ': ['Wireless mics', 'Subwoofer', 'Mixer included', 'DJ console'],
  Lighting: ['LED par lights', 'Moving heads', 'Fairy lights', 'DMX control', 'Outdoor rated'],
  'Stage & Decor': ['Flower decor', 'Backdrop', 'Truss', 'Carpet'],
  'Tents & Pandal': ['Waterproof', 'Side walls', 'Flooring'],
  'Chairs & Tables': ['Chair covers', 'Round tables', 'Banquet tables'],
  'Catering Equipment': ['Chafing dishes', 'Gas stove', 'Serving staff'],
  'Generators & Power': ['Silent', 'Fuel included', 'Cabling included'],
  'Projectors & Screens': ['HDMI cable', 'Screen included', 'Laptop included'],
  'Photo & Video': ['Tripod', 'Extra battery', 'Memory card'],
};

export function rentFeatureOptions(subcategory: string | null | undefined): string[] {
  const extra = (subcategory && SUBCATEGORY_FEATURES[subcategory]) || [];
  return [...extra, ...COMMON_RENT_FEATURES];
}

/** One spec field worth asking for, per subcategory */
export const SUBCATEGORY_SPEC: Record<string, { key: string; label: string; placeholder: string }> = {
  'Sound & DJ': { key: 'power', label: 'Total power', placeholder: 'e.g. 2000 W' },
  Lighting: { key: 'fixtures', label: 'Number of lights', placeholder: 'e.g. 12 LED pars' },
  'Generators & Power': { key: 'capacity', label: 'Capacity', placeholder: 'e.g. 15 kVA' },
  'Projectors & Screens': { key: 'brightness', label: 'Brightness', placeholder: 'e.g. 3500 lumens' },
  'Chairs & Tables': { key: 'quantity', label: 'Quantity', placeholder: 'e.g. 100 chairs' },
  'Tents & Pandal': { key: 'size', label: 'Size', placeholder: 'e.g. 40 × 60 ft' },
  Cars: { key: 'seats', label: 'Seats', placeholder: 'e.g. 5 seater, manual' },
  'Bikes & Scooters': { key: 'engine', label: 'Engine', placeholder: 'e.g. 125 cc' },
};

// --------------------------------------------------------------------
// Event planning — what a function typically needs, in booking order
// --------------------------------------------------------------------

export const EVENT_SUB_ICONS: Record<string, LucideIcon> = {
  'Halls & Venues': Landmark,
  'Sound & DJ': Speaker,
  Lighting: Lightbulb,
  'Stage & Decor': Sparkles,
  'Tents & Pandal': Tent,
  'Chairs & Tables': Armchair,
  'Catering Equipment': UtensilsCrossed,
  'Generators & Power': Zap,
  'Projectors & Screens': Projector,
  'Photo & Video': Camera,
};

export interface EventNeed {
  id: string;
  label: string;
  subcategories: string[];
  hint: string;
}

export const EVENT_NEEDS: EventNeed[] = [
  { id: 'venue', label: 'Venue', subcategories: ['Halls & Venues'], hint: 'Halls, auditoriums, lawns' },
  { id: 'sound', label: 'Sound', subcategories: ['Sound & DJ'], hint: 'Speakers, mics, DJ' },
  { id: 'lights', label: 'Lights', subcategories: ['Lighting'], hint: 'Stage & ambient lighting' },
  { id: 'stage', label: 'Stage & decor', subcategories: ['Stage & Decor'], hint: 'Stage, backdrop, flowers' },
  { id: 'seating', label: 'Seating & shelter', subcategories: ['Chairs & Tables', 'Tents & Pandal'], hint: 'Chairs, tables, pandal' },
  { id: 'power', label: 'Power', subcategories: ['Generators & Power'], hint: 'Generator backup' },
  { id: 'av', label: 'Screens & cameras', subcategories: ['Projectors & Screens', 'Photo & Video'], hint: 'Projector, camera kit' },
  { id: 'catering', label: 'Catering gear', subcategories: ['Catering Equipment'], hint: 'Chafing dishes, stoves' },
];

const EVENT_WORDS = ['event', 'fest', 'function', 'party', 'wedding', 'birthday', 'sound', 'speaker', 'dj', 'hall', 'venue', 'stage', 'light', 'mic', 'pandal', 'tent', 'reception', 'concert', 'program'];

export function isEventQuery(query: string): boolean {
  const q = query.toLowerCase();
  return EVENT_WORDS.some(w => q.includes(w));
}
