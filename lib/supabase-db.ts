import { supabase } from './supabase';
import { getCached, setCached, clearCache } from './cache';
import type { ListingType, RentUnit } from './catalog';

// ==================== TYPES ====================
export interface GeoPoint {
  lat: number;
  lng: number;
  address: string;
}

/** Shop opening hours, 24h "HH:MM"; closed_days uses 0 = Sunday */
export interface StoreHours {
  open: string;
  close: string;
  closed_days?: number[];
}

export interface UserProfile {
  uid: string;
  /** Private fields (email, phone, location, earnings…) are only filled for the signed-in user */
  email: string;
  displayName: string;
  avatarUrl: string;
  coverUrl?: string;
  phone: string;
  location: GeoPoint;
  earnings: number;
  isSeller: boolean;
  storeName?: string;
  storeDescription?: string;
  storeLocation?: GeoPoint;
  storeCategory?: string;
  storeHours?: StoreHours | null;
  savedProducts?: string[];
  rating?: number;
  reviewCount?: number;
  fcmToken?: string;
  createdAt: string;
  updatedAt: string;
  kycStatus?: 'NOT_STARTED' | 'IN_PROGRESS' | 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED' | 'ACTION_REQUIRED';
  kycRejectionReason?: string;
  isPrintProvider?: boolean;
  printPriceBW?: number;
  printPriceColor?: number;
  printStoreName?: string;
  printDescription?: string;
  printAvailableSizes?: string[];
  isAdmin?: boolean;
}

export interface Product {
  id: string;
  sellerId: string;
  sellerName?: string;
  sellerAvatar?: string;
  title: string;
  description: string;
  /** Sale price, or the rental rate per `rentDuration` unit */
  price: number;
  originalPrice?: number;
  category: string;
  subcategory?: string;
  condition?: string;
  images: string[];
  location: GeoPoint;
  status: 'available' | 'reserved' | 'sold' | 'rented' | 'paused' | string;
  listingType: ListingType | string;
  /** Pricing unit of a rental */
  rentDuration?: RentUnit | string;
  securityDeposit?: number;
  minUnits?: number;
  maxUnits?: number | null;
  capacity?: number | null;
  features?: string[];
  attributes?: Record<string, string>;
  views?: number;
  referenceUrl?: string;
  isPromoted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type OrderStatus = 'pending' | 'accepted' | 'active' | 'completed' | 'declined' | 'cancelled';

export interface OrderParty {
  displayName: string;
  storeName?: string;
  avatarUrl: string;
}

export interface Order {
  id: string;
  productId: string;
  sellerId: string;
  buyerId: string;
  productTitle: string;
  productImage: string;
  amount: number;
  depositAmount: number;
  status: OrderStatus | string;
  orderType: 'sale' | 'rent' | string;
  startAt?: string | null;
  endAt?: string | null;
  rentUnit?: RentUnit | string | null;
  units: number;
  rate?: number | null;
  notes?: string;
  paymentMethod: 'pay_at_pickup' | 'online' | string;
  paymentStatus: 'unpaid' | 'paid' | 'refund_pending' | 'refunded' | string;
  paymentId?: string;
  pickedUpAt?: string | null;
  returnedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  cancelledBy?: string | null;
  lateFee: number;
  declineReason?: string;
  buyer?: OrderParty;
  seller?: OrderParty;
  createdAt: string;
  updatedAt: string;
}

export interface Review {
  id: string;
  sellerId: string;
  buyerId: string;
  productId: string;
  orderId?: string;
  rating: number;
  comment: string;
  buyerName?: string;
  buyerAvatar?: string;
  sellerAvatar?: string;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message?: string;
  body?: string;
  read: boolean;
  type: 'order' | 'rental_reminder' | 'new_product' | 'report' | 'inquiry' | 'message' | 'back_in_stock' | 'review' | 'print_order' | 'kyc' | string;
  data?: Record<string, string | null | undefined>;
  createdAt: string;
}

export interface PrintOrder {
  id: string;
  providerId: string;
  buyerId: string;
  buyerName?: string;
  providerName?: string;
  providerAvatar?: string;
  providerPhone?: string;
  buyerPhone?: string;
  /** Object paths in the private print-docs bucket; open them with getPrintDocumentUrl() */
  filePaths: string[];
  fileNames?: string[];
  copies: number;
  colorMode?: string;
  paperSize?: string;
  pageCount?: number;
  sides?: string;
  orientation?: 'portrait' | 'landscape' | string;
  specialInstructions?: string;
  deliveryAddress?: string;
  totalAmount: number;
  status: 'pending' | 'accepted' | 'printing' | 'out_for_delivery' | 'completed' | 'declined' | 'cancelled' | string;
  paymentMethod?: string;
  paymentStatus?: string;
  paymentId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Withdrawal {
  id: string;
  amount: number;
  payoutMethod: string;
  destination: string;
  status: string;
  createdAt: string;
}

// ==================== HELPERS ====================

/** Storefront columns anyone may read (the rest of a profile is private) */
const PUBLIC_PROFILE_COLUMNS = [
  'id', 'display_name', 'avatar_url', 'cover_url', 'is_seller', 'store_name', 'store_description',
  'store_location', 'store_category', 'store_hours', 'rating', 'review_count', 'kyc_status',
  'is_print_provider', 'print_price_bw', 'print_price_color', 'print_store_name', 'print_description',
  'print_available_sizes', 'created_at',
].join(',');

const EMPTY_POINT: GeoPoint = { lat: 0, lng: 0, address: '' };

function toPoint(value: unknown): GeoPoint {
  if (!value || typeof value !== 'object') return { ...EMPTY_POINT };
  const v = value as { lat?: unknown; lng?: unknown; address?: unknown };
  return {
    lat: Number(v.lat) || 0,
    lng: Number(v.lng) || 0,
    address: typeof v.address === 'string' ? v.address : '',
  };
}

export function hasPoint(p?: { lat: number; lng: number } | null): p is GeoPoint {
  return Boolean(p && (p.lat !== 0 || p.lng !== 0) && Number.isFinite(p.lat) && Number.isFinite(p.lng));
}

/** Readable message for a Supabase error, with a hint when the schema is out of date */
function dbErrorMessage(error: { message?: string; code?: string } | null | undefined, fallback: string): string {
  if (!error) return fallback;
  if (error.code === 'PGRST202' || error.code === '42883' || error.code === 'PGRST204' || error.code === '42703') {
    return 'The database needs updating — run supabase/schema.sql in the Supabase SQL editor.';
  }
  return error.message || fallback;
}

// ==================== DEMO FALLBACK ====================
// Until supabase/seed-demo.sql has been run, browsing shows the same demo
// shops and listings from /demo/market.json (same ids as the seed).
interface DemoData { products: ProductRow[]; sellers: ProfileRow[] }
let demoData: Promise<DemoData> | null = null;

function loadDemo(): Promise<DemoData> {
  if (typeof window === 'undefined') return Promise.resolve({ products: [], sellers: [] });
  demoData ??= fetch('/demo/market.json')
    .then(r => (r.ok ? r.json() : { products: [], sellers: [] }))
    .catch(() => ({ products: [], sellers: [] }));
  return demoData;
}

/** Demo listings use ids that start with e0000000- (see seed-demo.sql) */
export function isDemoId(id: string): boolean {
  return id.startsWith('e0000000-') || id.startsWith('d0000000-');
}

/** Resolves to null if a query hangs, so pages never spin forever */
function withTimeout<T>(promise: PromiseLike<T>, ms = 8000): Promise<T | null> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<null>(resolve => setTimeout(() => resolve(null), ms)),
  ]);
}

async function rpc<T>(fn: string, args: Record<string, unknown>, fallback: string): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error && typeof args.p_product_id === 'string' && isDemoId(args.p_product_id) && /not found|PGRST202/i.test(`${error.message} ${error.code}`)) {
    throw new Error('This is a demo listing — run supabase/seed-demo.sql in Supabase to make it bookable.');
  }
  if (error) throw new Error(dbErrorMessage(error, fallback));
  return data as T;
}

// ==================== DATABASE ROWS ====================
type Num = number | string | null;

interface ProfileRow {
  id: string;
  email?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  cover_url?: string | null;
  phone?: string | null;
  location?: unknown;
  earnings?: Num;
  is_seller?: boolean | null;
  store_name?: string | null;
  store_description?: string | null;
  store_location?: unknown;
  store_category?: string | null;
  store_hours?: StoreHours | null;
  saved_products?: string[] | null;
  rating?: Num;
  review_count?: Num;
  fcm_token?: string | null;
  kyc_status?: string | null;
  kyc_rejection_reason?: string | null;
  is_print_provider?: boolean | null;
  print_price_bw?: Num;
  print_price_color?: Num;
  print_store_name?: string | null;
  print_description?: string | null;
  print_available_sizes?: string[] | null;
  is_admin?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface ProductRow {
  id: string;
  seller_id: string;
  title: string;
  description?: string | null;
  price?: Num;
  original_price?: Num;
  category?: string | null;
  subcategory?: string | null;
  condition?: string | null;
  images?: string[] | null;
  location?: unknown;
  status?: string | null;
  listing_type?: string | null;
  rent_duration?: string | null;
  security_deposit?: Num;
  min_units?: Num;
  max_units?: number | null;
  capacity?: number | null;
  features?: string[] | null;
  attributes?: Record<string, string> | null;
  views?: Num;
  reference_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface PartyRow {
  display_name?: string | null;
  store_name?: string | null;
  avatar_url?: string | null;
}

interface OrderRow {
  id: string;
  product_id: string;
  seller_id: string;
  buyer_id: string;
  product_title: string;
  product_image?: string | null;
  amount?: Num;
  deposit_amount?: Num;
  status?: string | null;
  order_type?: string | null;
  start_at?: string | null;
  end_at?: string | null;
  rent_unit?: string | null;
  units?: Num;
  rate?: Num;
  notes?: string | null;
  payment_method?: string | null;
  payment_status?: string | null;
  payment_id?: string | null;
  picked_up_at?: string | null;
  returned_at?: string | null;
  completed_at?: string | null;
  cancelled_at?: string | null;
  cancelled_by?: string | null;
  late_fee?: Num;
  decline_reason?: string | null;
  buyer?: PartyRow | null;
  seller?: PartyRow | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface ReviewRow {
  id: string;
  seller_id: string;
  buyer_id: string;
  product_id: string;
  order_id?: string | null;
  rating: Num;
  comment?: string | null;
  buyer?: PartyRow | null;
  created_at?: string | null;
}

interface NotificationRow {
  id: string;
  user_id: string;
  title: string;
  body?: string | null;
  read?: boolean | null;
  type?: string | null;
  data?: Record<string, string | null> | null;
  created_at?: string | null;
}

interface PrintOrderRow {
  id: string;
  provider_id: string;
  buyer_id: string;
  buyer_name?: string | null;
  buyer_phone?: string | null;
  provider_name?: string | null;
  provider_avatar?: string | null;
  file_paths?: string[] | null;
  file_names?: string[] | null;
  copies?: Num;
  page_count?: Num;
  color_mode?: string | null;
  paper_size?: string | null;
  orientation?: string | null;
  sides?: string | null;
  special_instructions?: string | null;
  delivery_address?: string | null;
  total_amount?: Num;
  status?: string | null;
  payment_method?: string | null;
  payment_status?: string | null;
  payment_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface WithdrawalRow {
  id: string;
  amount: Num;
  payout_method: string;
  destination: string;
  status: string;
  created_at: string;
}

interface QuoteRow {
  listingType: ListingType;
  unit: RentUnit | null;
  units: Num;
  rate: Num;
  amount: Num;
  deposit: Num;
}

interface ScanRow {
  action: HandoverAction;
  lateFee: Num;
  order: OrderRow;
}

// ==================== MAPPERS ====================
function mapProfile(row: ProfileRow): UserProfile {
  return {
    uid: row.id,
    email: row.email || '',
    displayName: row.display_name || '',
    avatarUrl: row.avatar_url || '',
    coverUrl: row.cover_url || '',
    phone: row.phone || '',
    location: toPoint(row.location),
    earnings: Number(row.earnings || 0),
    isSeller: Boolean(row.is_seller),
    storeName: row.store_name || '',
    storeDescription: row.store_description || '',
    storeLocation: toPoint(row.store_location),
    storeCategory: row.store_category || '',
    storeHours: row.store_hours || null,
    savedProducts: row.saved_products || [],
    rating: Number(row.rating ?? 5),
    reviewCount: Number(row.review_count || 0),
    fcmToken: row.fcm_token || '',
    kycStatus: (row.kyc_status || 'NOT_STARTED') as UserProfile['kycStatus'],
    kycRejectionReason: row.kyc_rejection_reason || '',
    isPrintProvider: Boolean(row.is_print_provider),
    printPriceBW: Number(row.print_price_bw ?? 2),
    printPriceColor: Number(row.print_price_color ?? 10),
    printStoreName: row.print_store_name || '',
    printDescription: row.print_description || '',
    printAvailableSizes: row.print_available_sizes || ['A4'],
    isAdmin: Boolean(row.is_admin),
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
  };
}

function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    sellerId: row.seller_id,
    title: row.title,
    description: row.description || '',
    price: Number(row.price || 0),
    originalPrice: row.original_price ? Number(row.original_price) : undefined,
    category: row.category || 'Other',
    subcategory: row.subcategory || '',
    condition: row.condition || '',
    images: row.images || [],
    location: toPoint(row.location),
    status: row.status || 'available',
    listingType: row.listing_type === 'rent' ? 'rent' : 'sale',
    rentDuration: row.rent_duration || 'day',
    securityDeposit: Number(row.security_deposit || 0),
    minUnits: Number(row.min_units || 1),
    maxUnits: row.max_units ?? null,
    capacity: row.capacity ?? null,
    features: row.features || [],
    attributes: row.attributes || {},
    views: Number(row.views || 0),
    referenceUrl: row.reference_url || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
  };
}

function mapParty(row: PartyRow | null | undefined): OrderParty | undefined {
  if (!row) return undefined;
  return { displayName: row.display_name || '', storeName: row.store_name || '', avatarUrl: row.avatar_url || '' };
}

function mapOrder(row: OrderRow): Order {
  return {
    id: row.id,
    productId: row.product_id,
    sellerId: row.seller_id,
    buyerId: row.buyer_id,
    productTitle: row.product_title,
    productImage: row.product_image || '',
    amount: Number(row.amount || 0),
    depositAmount: Number(row.deposit_amount || 0),
    status: row.status || 'pending',
    orderType: row.order_type === 'rent' ? 'rent' : 'sale',
    startAt: row.start_at,
    endAt: row.end_at,
    rentUnit: row.rent_unit,
    units: Number(row.units || 1),
    rate: row.rate != null ? Number(row.rate) : null,
    notes: row.notes || '',
    paymentMethod: row.payment_method || 'pay_at_pickup',
    paymentStatus: row.payment_status || 'unpaid',
    paymentId: row.payment_id || '',
    pickedUpAt: row.picked_up_at,
    returnedAt: row.returned_at,
    completedAt: row.completed_at,
    cancelledAt: row.cancelled_at,
    cancelledBy: row.cancelled_by,
    lateFee: Number(row.late_fee || 0),
    declineReason: row.decline_reason || '',
    buyer: mapParty(row.buyer),
    seller: mapParty(row.seller),
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
  };
}

function mapReview(r: ReviewRow): Review {
  return {
    id: r.id,
    sellerId: r.seller_id,
    buyerId: r.buyer_id,
    productId: r.product_id,
    orderId: r.order_id || undefined,
    rating: Number(r.rating),
    comment: r.comment || '',
    buyerName: r.buyer?.display_name || 'Lendly member',
    buyerAvatar: r.buyer?.avatar_url || '',
    createdAt: r.created_at || '',
  };
}

function mapNotification(n: NotificationRow): AppNotification {
  return {
    id: n.id,
    userId: n.user_id,
    title: n.title,
    body: n.body || '',
    message: n.body || '',
    read: Boolean(n.read),
    type: n.type || 'general',
    data: n.data || {},
    createdAt: n.created_at || '',
  };
}

function mapPrintOrder(row: PrintOrderRow): PrintOrder {
  return {
    id: row.id,
    providerId: row.provider_id,
    buyerId: row.buyer_id,
    buyerName: row.buyer_name || '',
    buyerPhone: row.buyer_phone || '',
    providerName: row.provider_name || '',
    providerAvatar: row.provider_avatar || '',
    filePaths: row.file_paths || [],
    fileNames: row.file_names || [],
    copies: Number(row.copies || 1),
    pageCount: Number(row.page_count || 1),
    colorMode: row.color_mode || 'bw',
    paperSize: row.paper_size || 'A4',
    orientation: row.orientation || 'portrait',
    sides: row.sides || 'single',
    specialInstructions: row.special_instructions || '',
    deliveryAddress: row.delivery_address || '',
    totalAmount: Number(row.total_amount || 0),
    status: row.status || 'pending',
    paymentMethod: row.payment_method || 'pay_on_delivery',
    paymentStatus: row.payment_status || 'unpaid',
    paymentId: row.payment_id || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
  };
}

// ==================== USER PROFILES ====================

/** Columns a user may write on their own profile */
function profilePayload(data: Partial<UserProfile>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (data.displayName !== undefined) payload.display_name = data.displayName;
  if (data.avatarUrl !== undefined) payload.avatar_url = data.avatarUrl;
  if (data.coverUrl !== undefined) payload.cover_url = data.coverUrl;
  if (data.phone !== undefined) payload.phone = data.phone;
  if (data.location !== undefined) payload.location = data.location;
  if (data.isSeller !== undefined) payload.is_seller = data.isSeller;
  if (data.storeName !== undefined) payload.store_name = data.storeName;
  if (data.storeDescription !== undefined) payload.store_description = data.storeDescription;
  if (data.storeLocation !== undefined) payload.store_location = data.storeLocation;
  if (data.storeCategory !== undefined) payload.store_category = data.storeCategory;
  if (data.storeHours !== undefined) payload.store_hours = data.storeHours;
  if (data.savedProducts !== undefined) payload.saved_products = data.savedProducts;
  if (data.fcmToken !== undefined) payload.fcm_token = data.fcmToken;
  if (data.isPrintProvider !== undefined) payload.is_print_provider = data.isPrintProvider;
  if (data.printPriceBW !== undefined) payload.print_price_bw = data.printPriceBW;
  if (data.printPriceColor !== undefined) payload.print_price_color = data.printPriceColor;
  if (data.printStoreName !== undefined) payload.print_store_name = data.printStoreName;
  if (data.printDescription !== undefined) payload.print_description = data.printDescription;
  if (data.printAvailableSizes !== undefined) payload.print_available_sizes = data.printAvailableSizes;
  return payload;
}

/** Saves onboarding details. The signup trigger normally creates the row already. */
export async function createUserProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
  const payload = profilePayload(data);
  const { data: updated, error } = await supabase.from('profiles').update(payload).eq('id', uid).select('id');
  if (error) throw new Error(dbErrorMessage(error, 'Could not save your profile'));
  if (!updated || updated.length === 0) {
    const { error: insertError } = await supabase.from('profiles').insert({ id: uid, ...payload });
    if (insertError) throw new Error(dbErrorMessage(insertError, 'Could not create your profile'));
  }
  clearCache(`user_${uid}`);
}

/** The signed-in user's full profile, private columns included */
export async function getMyProfile(): Promise<UserProfile | null> {
  const { data, error } = await supabase.rpc('get_my_profile').maybeSingle<ProfileRow>();
  if (error) {
    console.warn('get_my_profile failed:', error.message);
    return null;
  }
  return data ? mapProfile(data) : null;
}

/** Anyone's public storefront profile */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const cached = getCached<UserProfile>(`user_${uid}`, 60000);
  if (cached) return cached;

  const res = await withTimeout(supabase.from('profiles').select(PUBLIC_PROFILE_COLUMNS).eq('id', uid).maybeSingle<ProfileRow>());
  let data = res && !res.error ? res.data : null;
  if (!data && isDemoId(uid)) data = (await loadDemo()).sellers.find(s => s.id === uid) ?? null;
  if (!data) return null;

  const profile = mapProfile(data);
  setCached(`user_${uid}`, profile);
  return profile;
}

export async function updateUserProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
  const payload = profilePayload(data);
  if (Object.keys(payload).length === 0) return;
  const { error } = await supabase.from('profiles').update(payload).eq('id', uid);
  clearCache(`user_${uid}`);
  clearCache('all_sellers');
  if (error) throw new Error(dbErrorMessage(error, 'Could not update your profile'));
}

export async function toggleSavedProduct(uid: string, productId: string, current: string[]): Promise<string[]> {
  const updated = current.includes(productId)
    ? current.filter(id => id !== productId)
    : [...current, productId];
  await updateUserProfile(uid, { savedProducts: updated });
  return updated;
}

export async function getAllSellers(): Promise<UserProfile[]> {
  const cached = getCached<UserProfile[]>('all_sellers', 30000);
  if (cached) return cached;
  const res = await withTimeout(supabase.from('profiles').select(PUBLIC_PROFILE_COLUMNS).eq('is_seller', true).returns<ProfileRow[]>());
  const rows = res && !res.error && res.data ? res.data : [];
  // Demo shops fill in until real shops have listings
  const demo = (await getAllAvailableProducts()).some(p => isDemoId(p.id)) ? (await loadDemo()).sellers : [];
  const seen = new Set(rows.map(r => r.id));
  const sellers = [...rows, ...demo.filter(d => !seen.has(d.id))].map(mapProfile);
  setCached('all_sellers', sellers);
  return sellers;
}

export async function getAllPrintProviders(): Promise<UserProfile[]> {
  const { data, error } = await supabase.from('profiles').select(PUBLIC_PROFILE_COLUMNS).eq('is_print_provider', true).returns<ProfileRow[]>();
  if (error || !data) return [];
  return data.map(mapProfile);
}

// ==================== PRODUCTS ====================

function productPayload(data: Partial<Product>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (data.title !== undefined) payload.title = data.title;
  if (data.description !== undefined) payload.description = data.description;
  if (data.price !== undefined) payload.price = data.price;
  if (data.originalPrice !== undefined) payload.original_price = data.originalPrice ?? null;
  if (data.category !== undefined) payload.category = data.category;
  if (data.subcategory !== undefined) payload.subcategory = data.subcategory;
  if (data.condition !== undefined) payload.condition = data.condition;
  if (data.images !== undefined) payload.images = data.images;
  if (data.location !== undefined) payload.location = data.location;
  if (data.status !== undefined) payload.status = data.status;
  if (data.listingType !== undefined) payload.listing_type = data.listingType;
  if (data.rentDuration !== undefined) payload.rent_duration = data.rentDuration;
  if (data.securityDeposit !== undefined) payload.security_deposit = data.securityDeposit;
  if (data.minUnits !== undefined) payload.min_units = data.minUnits;
  if (data.maxUnits !== undefined) payload.max_units = data.maxUnits;
  if (data.capacity !== undefined) payload.capacity = data.capacity;
  if (data.features !== undefined) payload.features = data.features;
  if (data.attributes !== undefined) payload.attributes = data.attributes;
  if (data.referenceUrl !== undefined) payload.reference_url = data.referenceUrl || '';
  return payload;
}

export async function createProduct(data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const payload = {
    ...productPayload(data),
    seller_id: data.sellerId,
    status: data.status || 'available',
    listing_type: data.listingType === 'rent' ? 'rent' : 'sale',
    rent_duration: data.listingType === 'rent' ? data.rentDuration || 'day' : 'day',
  };

  const { data: inserted, error } = await supabase.from('products').insert(payload).select('id').single();
  if (error || !inserted) {
    throw new Error(dbErrorMessage(error, 'Could not publish the listing'));
  }
  clearCache('all_available_products');
  clearCache('all_sellers');
  return inserted.id;
}

export function getCachedProduct(id: string): Product | null {
  return getCached<Product>(`product_${id}`, 60000);
}

export async function getProduct(id: string): Promise<Product | null> {
  const cached = getCachedProduct(id);
  if (cached) return cached;

  const res = await withTimeout(supabase.from('products').select('*').eq('id', id).maybeSingle<ProductRow>());
  let data = res && !res.error ? res.data : null;
  if (!data && isDemoId(id)) data = (await loadDemo()).products.find(p => p.id === id) ?? null;
  if (!data) return null;

  const product = mapProduct(data);
  setCached(`product_${id}`, product);
  return product;
}

export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  if (ids.length === 0) return [];
  const res = await withTimeout(supabase.from('products').select('*').in('id', ids).returns<ProductRow[]>());
  const rows = res && !res.error && res.data ? [...res.data] : [];
  if (ids.some(isDemoId)) rows.push(...(await loadDemo()).products.filter(p => ids.includes(p.id)));
  const byId = new Map(rows.map(row => [row.id, mapProduct(row)]));
  return ids.map(id => byId.get(id)).filter((p): p is Product => Boolean(p));
}

export async function updateProduct(id: string, data: Partial<Product>): Promise<void> {
  const { error } = await supabase.from('products').update(productPayload(data)).eq('id', id);
  clearCache(`product_${id}`);
  clearCache('all_available_products');
  if (error) throw new Error(dbErrorMessage(error, 'Could not update the listing'));
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase.from('products').delete().eq('id', id);
  clearCache(`product_${id}`);
  clearCache('all_available_products');
  if (error) throw new Error(dbErrorMessage(error, 'Could not delete the listing'));
}

export async function getProductsBySeller(sellerId: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false });
  if ((error || !data?.length) && isDemoId(sellerId)) {
    return (await loadDemo()).products.filter(p => p.seller_id === sellerId).map(mapProduct);
  }
  if (error || !data) return [];
  return data.map(mapProduct);
}

export async function getAllAvailableProducts(): Promise<Product[]> {
  const cached = getCached<Product[]>('all_available_products', 15000);
  if (cached) return cached;

  const res = await withTimeout(supabase
    .from('products')
    .select('*')
    .eq('status', 'available')
    .order('created_at', { ascending: false })
    .limit(1000)
    .returns<ProductRow[]>());

  let rows = res && !res.error && res.data ? res.data : [];
  if (rows.length === 0) rows = (await loadDemo()).products;
  const products = rows.map(mapProduct);
  setCached('all_available_products', products);
  return products;
}

export async function incrementProductViews(id: string): Promise<void> {
  await supabase.rpc('increment_product_views', { p_product_id: id });
}

// ==================== BOOKINGS & ORDERS ====================

export interface Quote {
  listingType: ListingType;
  unit: RentUnit | null;
  units: number;
  rate: number;
  amount: number;
  deposit: number;
}

export async function quoteOrder(productId: string, start?: Date | null, end?: Date | null): Promise<Quote> {
  const q = await rpc<QuoteRow>('quote_order', {
    p_product_id: productId,
    p_start: start ? start.toISOString() : null,
    p_end: end ? end.toISOString() : null,
  }, 'Could not price this booking');
  return {
    listingType: q.listingType,
    unit: q.unit,
    units: Number(q.units),
    rate: Number(q.rate),
    amount: Number(q.amount),
    deposit: Number(q.deposit),
  };
}

export interface BookedSlot {
  startAt: string;
  endAt: string;
  status: string;
}

export async function getProductBookings(productId: string): Promise<BookedSlot[]> {
  const { data, error } = await supabase.rpc('get_product_bookings', { p_product_id: productId });
  if (error || !data) return [];
  return (data as { start_at: string; end_at: string; status: string }[]).map(b => ({ startAt: b.start_at, endAt: b.end_at, status: b.status }));
}

/** Rentals already taken during a window */
export async function getBookedProductIds(start: Date, end: Date): Promise<Set<string>> {
  const { data, error } = await supabase.rpc('get_booked_product_ids', {
    p_start: start.toISOString(),
    p_end: end.toISOString(),
  });
  if (error || !data) return new Set();
  return new Set((data as (string | { get_booked_product_ids: string })[]).map(v => (typeof v === 'string' ? v : v.get_booked_product_ids)));
}

/** Reserve (sale) or request a booking (rent); payment happens at pickup */
export async function createOrder(input: {
  productId: string;
  start?: Date | null;
  end?: Date | null;
  notes?: string;
}): Promise<Order> {
  const row = await rpc<OrderRow>('create_order', {
    p_product_id: input.productId,
    p_start: input.start ? input.start.toISOString() : null,
    p_end: input.end ? input.end.toISOString() : null,
    p_notes: input.notes || '',
  }, 'Could not place the order');
  clearCache('all_available_products');
  return mapOrder(row);
}

export async function respondToOrder(orderId: string, accept: boolean, reason = ''): Promise<Order> {
  const row = await rpc<OrderRow>('respond_to_order', { p_order_id: orderId, p_accept: accept, p_reason: reason }, 'Could not update the request');
  clearCache('all_available_products');
  return mapOrder(row);
}

export async function cancelOrder(orderId: string, reason = ''): Promise<Order> {
  const row = await rpc<OrderRow>('cancel_order', { p_order_id: orderId, p_reason: reason }, 'Could not cancel the order');
  clearCache('all_available_products');
  return mapOrder(row);
}

export type HandoverAction = 'sale_completed' | 'rental_started' | 'rental_returned';

export async function scanHandover(code: string): Promise<{ action: HandoverAction; lateFee: number; order: Order }> {
  const result = await rpc<ScanRow>('scan_handover', { p_code: code }, 'Could not verify this code');
  clearCache('all_available_products');
  return { action: result.action, lateFee: Number(result.lateFee || 0), order: mapOrder(result.order) };
}

/** The buyer's secret handover code (null for anyone else) */
export async function getHandoverCode(orderId: string): Promise<string | null> {
  const { data, error } = await supabase.from('order_secrets').select('handover_code').eq('order_id', orderId).maybeSingle();
  if (error || !data) return null;
  return data.handover_code;
}

const ORDER_SELECT = '*, buyer:profiles!orders_buyer_id_fkey(display_name,avatar_url), seller:profiles!orders_seller_id_fkey(display_name,store_name,avatar_url)';

export async function getOrder(id: string): Promise<Order | null> {
  const { data, error } = await supabase.from('orders').select(ORDER_SELECT).eq('id', id).maybeSingle();
  if (error || !data) return null;
  return mapOrder(data);
}

export async function getOrdersByBuyer(buyerId: string): Promise<Order[]> {
  const { data, error } = await supabase.from('orders').select(ORDER_SELECT).eq('buyer_id', buyerId).order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map(mapOrder);
}

export async function getOrdersBySeller(sellerId: string): Promise<Order[]> {
  const { data, error } = await supabase.from('orders').select(ORDER_SELECT).eq('seller_id', sellerId).order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map(mapOrder);
}

/** Live status of one order (e.g. the buyer's QR screen flips when the seller scans) */
export function subscribeToOrder(orderId: string, onChange: (order: Order) => void): () => void {
  const channel = supabase
    .channel(`order:${orderId}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
      payload => onChange(mapOrder(payload.new as OrderRow)))
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}

/** Fires whenever any order the user takes part in changes */
export function subscribeToMyOrders(userId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(`orders:${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `seller_id=eq.${userId}` }, () => onChange())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `buyer_id=eq.${userId}` }, () => onChange())
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}

// ==================== REVIEWS ====================

const REVIEW_SELECT = '*, buyer:profiles!reviews_buyer_id_fkey(display_name,avatar_url)';

export async function submitReview(orderId: string, rating: number, comment: string): Promise<Review> {
  const row = await rpc<ReviewRow>('submit_review', { p_order_id: orderId, p_rating: rating, p_comment: comment }, 'Could not submit the review');
  return mapReview(row);
}

export async function getReviewsForSeller(sellerId: string): Promise<Review[]> {
  const { data, error } = await supabase.from('reviews').select(REVIEW_SELECT).eq('seller_id', sellerId).order('created_at', { ascending: false }).limit(20);
  if (error || !data) return [];
  return data.map(mapReview);
}

export async function getReviewsForProduct(productId: string): Promise<Review[]> {
  const { data, error } = await supabase.from('reviews').select(REVIEW_SELECT).eq('product_id', productId).order('created_at', { ascending: false }).limit(20);
  if (error || !data) return [];
  return data.map(mapReview);
}

/** Which of these orders already have a review */
export async function getReviewedOrderIds(orderIds: string[]): Promise<Set<string>> {
  if (orderIds.length === 0) return new Set();
  const { data } = await supabase.from('reviews').select('order_id').in('order_id', orderIds);
  return new Set((data || []).map(r => r.order_id as string));
}

// ==================== REPORTS ====================

export async function createReport(data: {
  reporterId: string;
  productId?: string;
  sellerId?: string;
  orderId?: string;
  reason: string;
  description?: string;
}): Promise<void> {
  const { error } = await supabase.from('reports').insert({
    reporter_id: data.reporterId,
    product_id: data.productId || null,
    seller_id: data.sellerId || null,
    order_id: data.orderId || null,
    reason: data.reason.slice(0, 500),
    description: (data.description || '').slice(0, 2000),
  });
  if (error) throw new Error(dbErrorMessage(error, 'Could not submit the report'));
}

// ==================== FOLLOWS & STOCK ALERTS ====================

export async function subscribeToSeller(subscriberId: string, sellerId: string): Promise<void> {
  const { error } = await supabase.from('seller_follows').insert({ follower_id: subscriberId, seller_id: sellerId });
  if (error && error.code !== '23505') throw new Error(dbErrorMessage(error, 'Could not follow this shop'));
}

export async function unsubscribeFromSeller(subscriberId: string, sellerId: string): Promise<void> {
  const { error } = await supabase.from('seller_follows').delete().eq('follower_id', subscriberId).eq('seller_id', sellerId);
  if (error) throw new Error(dbErrorMessage(error, 'Could not unfollow this shop'));
}

export async function isSubscribed(subscriberId: string, sellerId: string): Promise<boolean> {
  const { data } = await supabase.from('seller_follows').select('seller_id').eq('follower_id', subscriberId).eq('seller_id', sellerId).maybeSingle();
  return Boolean(data);
}

export async function subscribeToStockNotification(userId: string, productId: string): Promise<void> {
  const { error } = await supabase.from('stock_alerts').insert({ user_id: userId, product_id: productId });
  if (error && error.code !== '23505') throw new Error(dbErrorMessage(error, 'Could not set the alert'));
}

export async function unsubscribeFromStockNotification(userId: string, productId: string): Promise<void> {
  const { error } = await supabase.from('stock_alerts').delete().eq('user_id', userId).eq('product_id', productId);
  if (error) throw new Error(dbErrorMessage(error, 'Could not remove the alert'));
}

export async function isSubscribedToStock(userId: string, productId: string): Promise<boolean> {
  const { data } = await supabase.from('stock_alerts').select('product_id').eq('user_id', userId).eq('product_id', productId).maybeSingle();
  return Boolean(data);
}

// ==================== NOTIFICATIONS ====================

export async function getNotifications(userId: string): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error || !data) return [];
  return data.map(mapNotification);
}

export async function markNotificationRead(id: string): Promise<void> {
  await supabase.from('notifications').update({ read: true }).eq('id', id);
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false);
}

export function subscribeToNotifications(userId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, () => onChange())
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}

// ==================== PAYOUTS ====================

export async function requestWithdrawal(amount: number, method: 'upi' | 'bank_transfer', destination: string): Promise<Withdrawal> {
  const row = await rpc<WithdrawalRow>('request_withdrawal', { p_amount: amount, p_method: method, p_destination: destination }, 'Withdrawal failed');
  return {
    id: row.id,
    amount: Number(row.amount),
    payoutMethod: row.payout_method,
    destination: row.destination,
    status: row.status,
    createdAt: row.created_at,
  };
}

// ==================== PRINT ORDERS ====================

export async function createPrintOrder(input: {
  providerId: string;
  filePaths: string[];
  fileNames: string[];
  copies: number;
  pageCount: number;
  colorMode: 'bw' | 'color';
  paperSize: string;
  orientation: string;
  sides: 'single' | 'double';
  specialInstructions: string;
  deliveryAddress: string;
  phone: string;
}): Promise<PrintOrder> {
  const row = await rpc<PrintOrderRow>('create_print_order', {
    p_provider_id: input.providerId,
    p_file_paths: input.filePaths,
    p_file_names: input.fileNames,
    p_copies: input.copies,
    p_page_count: input.pageCount,
    p_color_mode: input.colorMode,
    p_paper_size: input.paperSize,
    p_orientation: input.orientation,
    p_sides: input.sides,
    p_instructions: input.specialInstructions,
    p_address: input.deliveryAddress,
    p_phone: input.phone,
  }, 'Could not place the print order');
  return mapPrintOrder(row);
}

export async function getPrintOrdersByBuyer(buyerId: string): Promise<PrintOrder[]> {
  const { data, error } = await supabase.from('print_orders').select('*').eq('buyer_id', buyerId).order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map(mapPrintOrder);
}

export async function getPrintOrdersByProvider(providerId: string): Promise<PrintOrder[]> {
  const { data, error } = await supabase.from('print_orders').select('*').eq('provider_id', providerId).order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map(mapPrintOrder);
}

export async function updatePrintOrder(id: string, data: Partial<PrintOrder>): Promise<void> {
  if (!data.status) return;
  await rpc<PrintOrderRow>('update_print_order_status', { p_id: id, p_status: data.status }, 'Could not update the print order');
}

function listenToPrintOrders(column: 'buyer_id' | 'provider_id', userId: string, callback: (orders: PrintOrder[]) => void) {
  const load = () => (column === 'buyer_id' ? getPrintOrdersByBuyer(userId) : getPrintOrdersByProvider(userId)).then(callback);
  void load();
  const channel = supabase
    .channel(`print_orders:${column}:${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'print_orders', filter: `${column}=eq.${userId}` }, () => { void load(); })
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}

export function listenToPrintOrdersByBuyer(buyerId: string, callback: (orders: PrintOrder[]) => void) {
  return listenToPrintOrders('buyer_id', buyerId, callback);
}

export function listenToPrintOrdersByProvider(providerId: string, callback: (orders: PrintOrder[]) => void) {
  return listenToPrintOrders('provider_id', providerId, callback);
}
