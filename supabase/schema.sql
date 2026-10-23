-- ====================================================================
-- Lendly Supabase Database Schema
--
-- Run the whole file in the Supabase Dashboard → SQL Editor.
-- It is idempotent: safe on a fresh project and safe to re-run on a
-- project that already has the original Lendly tables (it upgrades them
-- in place without dropping data).
--
-- Every state change that involves two people (orders, handovers,
-- reviews, chats, withdrawals, print jobs) goes through a SECURITY
-- DEFINER function below, so the browser never needs the service-role key
-- and can't write those tables directly.
-- ====================================================================


-- ====================================================================
-- 0. SHARED HELPERS
-- ====================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

-- Hours in one pricing unit of a rental
CREATE OR REPLACE FUNCTION public.rent_unit_hours(p_unit TEXT)
RETURNS NUMERIC LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_unit
    WHEN 'hour' THEN 1
    WHEN 'day' THEN 24
    WHEN 'week' THEN 168
    WHEN 'month' THEN 720
    ELSE 24
  END::NUMERIC;
$$;


-- ====================================================================
-- 1. PROFILES (one row per auth user)
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  cover_url TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  location JSONB DEFAULT '{"lat": 0, "lng": 0, "address": ""}'::jsonb,
  earnings NUMERIC(12, 2) DEFAULT 0.00,
  is_seller BOOLEAN DEFAULT FALSE,
  store_name TEXT DEFAULT '',
  store_description TEXT DEFAULT '',
  store_location JSONB DEFAULT '{"lat": 0, "lng": 0, "address": ""}'::jsonb,
  store_category TEXT DEFAULT '',
  store_hours JSONB,
  is_admin BOOLEAN DEFAULT FALSE,
  saved_products TEXT[] DEFAULT '{}',
  rating NUMERIC(3, 2) DEFAULT 5.00,
  review_count INTEGER DEFAULT 0,
  fcm_token TEXT DEFAULT '',
  kyc_status TEXT DEFAULT 'NOT_STARTED',
  kyc_rejection_reason TEXT DEFAULT '',
  is_print_provider BOOLEAN DEFAULT FALSE,
  print_price_bw NUMERIC(8, 2) DEFAULT 2.00,
  print_price_color NUMERIC(8, 2) DEFAULT 10.00,
  print_store_name TEXT DEFAULT '',
  print_description TEXT DEFAULT '',
  print_available_sizes TEXT[] DEFAULT ARRAY['A4'],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Storefront details shown on "Shops near you"
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS store_category TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS store_hours JSONB;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Rows are public, but only storefront columns are. Email, phone, home
-- location, earnings and admin/KYC flags are readable only through
-- get_my_profile(), and balances/ratings/KYC can only be changed by the
-- functions in this file.
REVOKE SELECT, INSERT, UPDATE ON public.profiles FROM anon, authenticated;
GRANT SELECT (
  id, display_name, avatar_url, cover_url,
  is_seller, store_name, store_description, store_location, store_category, store_hours,
  rating, review_count, kyc_status,
  is_print_provider, print_price_bw, print_price_color, print_store_name,
  print_description, print_available_sizes, created_at
) ON public.profiles TO anon, authenticated;
GRANT INSERT (
  id, display_name, avatar_url, cover_url, phone, location,
  is_seller, store_name, store_description, store_location, store_category, store_hours,
  saved_products, fcm_token,
  is_print_provider, print_price_bw, print_price_color, print_store_name,
  print_description, print_available_sizes, updated_at
) ON public.profiles TO authenticated;
GRANT UPDATE (
  display_name, avatar_url, cover_url, phone, location,
  is_seller, store_name, store_description, store_location, store_category, store_hours,
  saved_products, fcm_token,
  is_print_provider, print_price_bw, print_price_color, print_store_name,
  print_description, print_available_sizes, updated_at
) ON public.profiles TO authenticated;

-- The signed-in user's full row, private columns included
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS SETOF public.profiles
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.profiles WHERE id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.get_my_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;

-- Automatically create a profile when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ====================================================================
-- 2. PRODUCTS (sale listings and rentals)
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  original_price NUMERIC(10, 2),
  category TEXT NOT NULL DEFAULT 'Other',
  condition TEXT DEFAULT 'Used',
  images TEXT[] DEFAULT '{}',
  location JSONB DEFAULT '{"lat": 0, "lng": 0, "address": ""}'::jsonb,
  status TEXT DEFAULT 'available',
  listing_type TEXT DEFAULT 'sale', -- 'sale' | 'rent'
  rent_duration TEXT DEFAULT 'day', -- pricing unit of a rental: 'hour' | 'day' | 'week' | 'month'
  views INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS subcategory TEXT DEFAULT '';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS reference_url TEXT DEFAULT '';
-- Rental terms
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS security_deposit NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS min_units INTEGER DEFAULT 1;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS max_units INTEGER;
-- Venues: guests it holds
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS capacity INTEGER;
-- Short tags: "AC", "Parking", "Delivery available", "Operator included"
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS features TEXT[] DEFAULT '{}';
-- Category-specific specs, e.g. {"power": "2000 W"}
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS attributes JSONB DEFAULT '{}'::jsonb;

-- NOT VALID keeps any legacy rows loadable while new writes are checked
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_listing_type_check;
ALTER TABLE public.products ADD CONSTRAINT products_listing_type_check
  CHECK (listing_type IN ('sale', 'rent')) NOT VALID;
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_rent_duration_check;
ALTER TABLE public.products ADD CONSTRAINT products_rent_duration_check
  CHECK (rent_duration IS NULL OR rent_duration IN ('hour', 'day', 'week', 'month')) NOT VALID;
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_status_check;
ALTER TABLE public.products ADD CONSTRAINT products_status_check
  CHECK (status IN ('available', 'reserved', 'sold', 'rented', 'paused')) NOT VALID;
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_amounts_check;
ALTER TABLE public.products ADD CONSTRAINT products_amounts_check
  CHECK (price >= 0 AND COALESCE(security_deposit, 0) >= 0
         AND COALESCE(min_units, 1) >= 1
         AND (max_units IS NULL OR max_units >= COALESCE(min_units, 1))
         AND (capacity IS NULL OR capacity > 0)) NOT VALID;

CREATE INDEX IF NOT EXISTS products_status_type_idx ON public.products (status, listing_type);
CREATE INDEX IF NOT EXISTS products_seller_idx ON public.products (seller_id);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Lenders verify their identity before listing (verify → set up shop → list).
-- A submitted verification is enough to list; approval adds the Verified badge.
CREATE OR REPLACE FUNCTION public.kyc_submitted()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT kyc_status IN ('PENDING_VERIFICATION', 'VERIFIED') FROM public.profiles WHERE id = auth.uid()),
    FALSE);
$$;

DROP POLICY IF EXISTS "Anyone can view available products" ON public.products;
DROP POLICY IF EXISTS "Sellers can create products" ON public.products;
DROP POLICY IF EXISTS "Sellers can update their own products" ON public.products;
DROP POLICY IF EXISTS "Sellers can delete their own products" ON public.products;

CREATE POLICY "Anyone can view available products"
  ON public.products FOR SELECT USING (true);
CREATE POLICY "Sellers can create products"
  ON public.products FOR INSERT WITH CHECK (auth.uid() = seller_id AND public.kyc_submitted());
CREATE POLICY "Sellers can update their own products"
  ON public.products FOR UPDATE USING (auth.uid() = seller_id) WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "Sellers can delete their own products"
  ON public.products FOR DELETE USING (auth.uid() = seller_id);

DROP TRIGGER IF EXISTS products_set_updated_at ON public.products;
CREATE TRIGGER products_set_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Posting a first listing turns the account into a storefront
CREATE OR REPLACE FUNCTION public.handle_new_listing()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles
  SET is_seller = TRUE,
      store_name = COALESCE(NULLIF(store_name, ''), display_name),
      store_location = CASE
        WHEN COALESCE((store_location->>'lat')::NUMERIC, 0) = 0
         AND COALESCE((store_location->>'lng')::NUMERIC, 0) = 0
        THEN NEW.location ELSE store_location END
  WHERE id = NEW.seller_id AND is_seller IS NOT TRUE;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_product_created ON public.products;
CREATE TRIGGER on_product_created
  AFTER INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_listing();

CREATE OR REPLACE FUNCTION public.increment_product_views(p_product_id UUID)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.products SET views = COALESCE(views, 0) + 1 WHERE id = p_product_id;
$$;


-- ====================================================================
-- 3. NOTIFICATIONS
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT DEFAULT '',
  type TEXT DEFAULT 'general',
  data JSONB DEFAULT '{}'::jsonb,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_user_idx ON public.notifications (user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read their notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users mark their notifications read" ON public.notifications;
DROP POLICY IF EXISTS "Users delete their notifications" ON public.notifications;

CREATE POLICY "Users read their notifications"
  ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users mark their notifications read"
  ON public.notifications FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete their notifications"
  ON public.notifications FOR DELETE USING (auth.uid() = user_id);

-- Only the read flag is client-editable; inserts come from _notify()
REVOKE INSERT, UPDATE ON public.notifications FROM anon, authenticated;
GRANT UPDATE (read) ON public.notifications TO authenticated;

CREATE OR REPLACE FUNCTION public._notify(
  p_user UUID, p_title TEXT, p_body TEXT, p_type TEXT, p_data JSONB DEFAULT '{}'::jsonb
) RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.notifications (user_id, title, body, type, data)
  VALUES (p_user, p_title, COALESCE(p_body, ''), COALESCE(p_type, 'general'), COALESCE(p_data, '{}'::jsonb));
$$;
REVOKE ALL ON FUNCTION public._notify(UUID, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;


-- ====================================================================
-- 4. ORDERS (purchases and rental bookings)
--
-- pending   → buyer asked; seller hasn't answered
-- accepted  → seller confirmed (sale item reserved / rental slot locked)
-- active    → rental item handed over (pickup QR scanned)
-- completed → sale handed over, or rental returned
-- declined  → seller said no
-- cancelled → either side backed out before the handover
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  seller_id UUID NOT NULL REFERENCES public.profiles(id),
  buyer_id UUID NOT NULL REFERENCES public.profiles(id),
  product_title TEXT NOT NULL,
  product_image TEXT DEFAULT '',
  amount NUMERIC(10, 2) NOT NULL,
  deposit_amount NUMERIC(10, 2) DEFAULT 0.00,
  status TEXT DEFAULT 'pending',
  order_type TEXT DEFAULT 'sale', -- 'sale' | 'rent'
  qr_code TEXT,
  escrow_locked BOOLEAN DEFAULT FALSE,
  payment_id TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS start_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS end_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS rent_unit TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS units INTEGER DEFAULT 1;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS rate NUMERIC(10, 2);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'pay_at_pickup'; -- 'pay_at_pickup' | 'online'
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid'; -- 'unpaid' | 'paid' | 'refund_pending' | 'refunded'
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS returned_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancelled_by UUID;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS late_fee NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS decline_reason TEXT DEFAULT '';

CREATE INDEX IF NOT EXISTS orders_product_status_idx ON public.orders (product_id, status);
CREATE INDEX IF NOT EXISTS orders_buyer_idx ON public.orders (buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_seller_idx ON public.orders (seller_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS orders_payment_id_key ON public.orders (payment_id)
  WHERE payment_id IS NOT NULL AND payment_id <> '';

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view orders they are part of" ON public.orders;
DROP POLICY IF EXISTS "Buyers can create orders" ON public.orders;
DROP POLICY IF EXISTS "Participants can update order status" ON public.orders;

-- Read-only from the client; writes go through the functions below
CREATE POLICY "Users can view orders they are part of"
  ON public.orders FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

DROP TRIGGER IF EXISTS orders_set_updated_at ON public.orders;
CREATE TRIGGER orders_set_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- The code inside the buyer's handover QR. Only the buyer can read it;
-- the seller proves the buyer is present by scanning it.
CREATE TABLE IF NOT EXISTS public.order_secrets (
  order_id UUID PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  handover_code TEXT NOT NULL UNIQUE
);

ALTER TABLE public.order_secrets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Buyers read their handover code" ON public.order_secrets;
CREATE POLICY "Buyers read their handover code"
  ON public.order_secrets FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.buyer_id = auth.uid())
  );

-- Price for a listing over a period, computed only from the database
CREATE OR REPLACE FUNCTION public.quote_order(
  p_product_id UUID, p_start TIMESTAMPTZ DEFAULT NULL, p_end TIMESTAMPTZ DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_product public.products;
  v_units INTEGER := 1;
BEGIN
  SELECT * INTO v_product FROM public.products WHERE id = p_product_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Listing not found';
  END IF;

  IF v_product.listing_type = 'rent' THEN
    IF p_start IS NULL OR p_end IS NULL OR p_end <= p_start THEN
      RAISE EXCEPTION 'Choose a valid rental period';
    END IF;
    v_units := GREATEST(1, CEIL(EXTRACT(EPOCH FROM (p_end - p_start)) / 3600.0
                               / public.rent_unit_hours(v_product.rent_duration))::INTEGER);
  END IF;

  RETURN jsonb_build_object(
    'listingType', v_product.listing_type,
    'unit', CASE WHEN v_product.listing_type = 'rent' THEN COALESCE(v_product.rent_duration, 'day') END,
    'units', v_units,
    'rate', v_product.price,
    'amount', v_units * v_product.price,
    'deposit', CASE WHEN v_product.listing_type = 'rent' THEN COALESCE(v_product.security_deposit, 0) ELSE 0 END
  );
END;
$$;

-- Shared by create_order (pay at pickup) and create_paid_order (online)
CREATE OR REPLACE FUNCTION public._place_order(
  p_buyer UUID,
  p_product_id UUID,
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ,
  p_notes TEXT,
  p_payment_method TEXT,
  p_payment_status TEXT,
  p_payment_id TEXT,
  p_razorpay_order_id TEXT,
  p_expected_amount NUMERIC
) RETURNS public.orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_product public.products;
  v_units INTEGER := 1;
  v_amount NUMERIC;
  v_order public.orders;
  v_buyer_name TEXT;
  v_is_rent BOOLEAN;
BEGIN
  IF p_buyer IS NULL THEN
    RAISE EXCEPTION 'Please sign in to continue';
  END IF;

  -- Locking the listing serialises concurrent requests for it
  SELECT * INTO v_product FROM public.products WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Listing not found';
  END IF;
  IF v_product.seller_id = p_buyer THEN
    RAISE EXCEPTION 'You cannot order your own listing';
  END IF;
  IF v_product.status <> 'available' THEN
    RAISE EXCEPTION 'This listing is not available right now';
  END IF;

  v_is_rent := v_product.listing_type = 'rent';

  IF v_is_rent THEN
    IF p_start IS NULL OR p_end IS NULL OR p_end <= p_start THEN
      RAISE EXCEPTION 'Choose a valid rental period';
    END IF;
    IF p_start < NOW() - INTERVAL '12 hours' THEN
      RAISE EXCEPTION 'The rental start date is in the past';
    END IF;
    v_units := GREATEST(1, CEIL(EXTRACT(EPOCH FROM (p_end - p_start)) / 3600.0
                               / public.rent_unit_hours(v_product.rent_duration))::INTEGER);
    IF v_units < COALESCE(v_product.min_units, 1) THEN
      RAISE EXCEPTION 'Minimum booking is % %(s)', COALESCE(v_product.min_units, 1), COALESCE(v_product.rent_duration, 'day');
    END IF;
    IF v_product.max_units IS NOT NULL AND v_units > v_product.max_units THEN
      RAISE EXCEPTION 'Maximum booking is % %(s)', v_product.max_units, COALESCE(v_product.rent_duration, 'day');
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.product_id = p_product_id AND o.status IN ('accepted', 'active')
        AND tstzrange(o.start_at, o.end_at) && tstzrange(p_start, p_end)
    ) THEN
      RAISE EXCEPTION 'Those dates are already booked — pick another slot';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.product_id = p_product_id AND o.buyer_id = p_buyer AND o.status = 'pending'
        AND tstzrange(o.start_at, o.end_at) && tstzrange(p_start, p_end)
    ) THEN
      RAISE EXCEPTION 'You already have a pending request for these dates';
    END IF;
  ELSE
    IF EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.product_id = p_product_id AND o.buyer_id = p_buyer AND o.status IN ('pending', 'accepted')
    ) THEN
      RAISE EXCEPTION 'You already have an open request for this item';
    END IF;
  END IF;

  v_amount := v_units * v_product.price;
  IF p_expected_amount IS NOT NULL AND p_expected_amount <> v_amount THEN
    RAISE EXCEPTION 'The price changed — please review the booking and try again';
  END IF;

  INSERT INTO public.orders (
    product_id, seller_id, buyer_id, product_title, product_image,
    amount, deposit_amount, status, order_type,
    start_at, end_at, rent_unit, units, rate, notes,
    payment_method, payment_status, payment_id, razorpay_order_id
  ) VALUES (
    v_product.id, v_product.seller_id, p_buyer, v_product.title, COALESCE(v_product.images[1], ''),
    v_amount, CASE WHEN v_is_rent THEN COALESCE(v_product.security_deposit, 0) ELSE 0 END,
    'pending', CASE WHEN v_is_rent THEN 'rent' ELSE 'sale' END,
    CASE WHEN v_is_rent THEN p_start END, CASE WHEN v_is_rent THEN p_end END,
    CASE WHEN v_is_rent THEN COALESCE(v_product.rent_duration, 'day') END,
    v_units, v_product.price, LEFT(COALESCE(p_notes, ''), 1000),
    p_payment_method, p_payment_status, COALESCE(p_payment_id, ''), p_razorpay_order_id
  ) RETURNING * INTO v_order;

  INSERT INTO public.order_secrets (order_id, handover_code)
  VALUES (v_order.id, 'LND-' || UPPER(SUBSTR(REPLACE(gen_random_uuid()::TEXT, '-', ''), 1, 10)));

  SELECT COALESCE(NULLIF(display_name, ''), 'A neighbour') INTO v_buyer_name FROM public.profiles WHERE id = p_buyer;

  PERFORM public._notify(
    v_product.seller_id,
    CASE WHEN v_is_rent THEN 'New booking request' ELSE 'New purchase request' END,
    v_buyer_name || CASE WHEN v_is_rent
      THEN ' wants to rent "' || v_product.title || '" from ' || TO_CHAR(p_start AT TIME ZONE 'Asia/Kolkata', 'DD Mon, HH12:MI AM')
      ELSE ' wants to buy "' || v_product.title || '"' END,
    'order',
    jsonb_build_object('orderId', v_order.id, 'productId', v_product.id)
  );

  RETURN v_order;
END;
$$;
REVOKE ALL ON FUNCTION public._place_order(UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC) FROM PUBLIC, anon, authenticated;

-- Reserve now, pay the seller at pickup
CREATE OR REPLACE FUNCTION public.create_order(
  p_product_id UUID,
  p_start TIMESTAMPTZ DEFAULT NULL,
  p_end TIMESTAMPTZ DEFAULT NULL,
  p_notes TEXT DEFAULT ''
) RETURNS public.orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN public._place_order(auth.uid(), p_product_id, p_start, p_end, p_notes,
                             'pay_at_pickup', 'unpaid', NULL, NULL, NULL);
END;
$$;
REVOKE ALL ON FUNCTION public.create_order(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_order(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO authenticated;

-- Called by /api/payment/verify (service role) once Razorpay confirms capture
CREATE OR REPLACE FUNCTION public.create_paid_order(
  p_buyer UUID,
  p_product_id UUID,
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ,
  p_notes TEXT,
  p_amount NUMERIC,
  p_payment_id TEXT,
  p_razorpay_order_id TEXT
) RETURNS public.orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_existing public.orders;
BEGIN
  -- The checkout callback and the webhook may report the same payment at
  -- once; serialise them so the second simply gets the first one's order.
  PERFORM pg_advisory_xact_lock(hashtext('lendly_payment:' || p_payment_id));
  SELECT * INTO v_existing FROM public.orders WHERE payment_id = p_payment_id;
  IF FOUND THEN
    RETURN v_existing;
  END IF;
  RETURN public._place_order(p_buyer, p_product_id, p_start, p_end, p_notes,
                             'online', 'paid', p_payment_id, p_razorpay_order_id, p_amount);
END;
$$;
REVOKE ALL ON FUNCTION public.create_paid_order(UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_paid_order(UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, NUMERIC, TEXT, TEXT) TO service_role;

-- Seller confirms a pending order (also used by an implicit accept at scan time)
CREATE OR REPLACE FUNCTION public._accept_order(p_order_id UUID)
RETURNS public.orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order public.orders;
  v_product public.products;
  v_other RECORD;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF v_order.status <> 'pending' THEN
    RAISE EXCEPTION 'This request is already %', v_order.status;
  END IF;

  SELECT * INTO v_product FROM public.products WHERE id = v_order.product_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This listing no longer exists';
  END IF;

  IF v_order.order_type = 'rent' THEN
    IF EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.product_id = v_order.product_id AND o.id <> v_order.id
        AND o.status IN ('accepted', 'active')
        AND tstzrange(o.start_at, o.end_at) && tstzrange(v_order.start_at, v_order.end_at)
    ) THEN
      RAISE EXCEPTION 'You already accepted another booking for these dates';
    END IF;

    UPDATE public.orders SET status = 'accepted' WHERE id = v_order.id RETURNING * INTO v_order;

    -- Other requests for the same slot can no longer be honoured
    FOR v_other IN
      SELECT id, buyer_id, payment_status FROM public.orders o
      WHERE o.product_id = v_order.product_id AND o.id <> v_order.id AND o.status = 'pending'
        AND tstzrange(o.start_at, o.end_at) && tstzrange(v_order.start_at, v_order.end_at)
    LOOP
      UPDATE public.orders
      SET status = 'declined',
          decline_reason = 'Those dates were booked by another renter',
          payment_status = CASE WHEN v_other.payment_status = 'paid' THEN 'refund_pending' ELSE payment_status END
      WHERE id = v_other.id;
      PERFORM public._notify(v_other.buyer_id, 'Dates no longer available',
        '"' || v_order.product_title || '" was booked for an overlapping slot.', 'order',
        jsonb_build_object('orderId', v_other.id, 'productId', v_order.product_id));
    END LOOP;
  ELSE
    IF v_product.status <> 'available' THEN
      RAISE EXCEPTION 'This listing is no longer available';
    END IF;
    UPDATE public.products SET status = 'reserved' WHERE id = v_product.id;
    UPDATE public.orders SET status = 'accepted' WHERE id = v_order.id RETURNING * INTO v_order;

    FOR v_other IN
      SELECT id, buyer_id, payment_status FROM public.orders o
      WHERE o.product_id = v_order.product_id AND o.id <> v_order.id AND o.status = 'pending'
    LOOP
      UPDATE public.orders
      SET status = 'declined',
          decline_reason = 'The seller accepted another buyer',
          payment_status = CASE WHEN v_other.payment_status = 'paid' THEN 'refund_pending' ELSE payment_status END
      WHERE id = v_other.id;
      PERFORM public._notify(v_other.buyer_id, 'Item reserved for someone else',
        '"' || v_order.product_title || '" was reserved by another buyer.', 'order',
        jsonb_build_object('orderId', v_other.id, 'productId', v_order.product_id));
    END LOOP;
  END IF;

  PERFORM public._notify(v_order.buyer_id,
    CASE WHEN v_order.order_type = 'rent' THEN 'Booking confirmed' ELSE 'Request accepted' END,
    '"' || v_order.product_title || '" is confirmed. Show your handover QR at pickup.', 'order',
    jsonb_build_object('orderId', v_order.id, 'productId', v_order.product_id));

  RETURN v_order;
END;
$$;
REVOKE ALL ON FUNCTION public._accept_order(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.respond_to_order(
  p_order_id UUID, p_accept BOOLEAN, p_reason TEXT DEFAULT ''
) RETURNS public.orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order public.orders;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR v_order.seller_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  IF v_order.status <> 'pending' THEN
    RAISE EXCEPTION 'This request is already %', v_order.status;
  END IF;

  IF p_accept THEN
    RETURN public._accept_order(p_order_id);
  END IF;

  UPDATE public.orders
  SET status = 'declined',
      decline_reason = LEFT(COALESCE(NULLIF(p_reason, ''), 'The seller declined this request'), 300),
      payment_status = CASE WHEN payment_status = 'paid' THEN 'refund_pending' ELSE payment_status END
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  PERFORM public._notify(v_order.buyer_id, 'Request declined',
    '"' || v_order.product_title || '": ' || v_order.decline_reason, 'order',
    jsonb_build_object('orderId', v_order.id, 'productId', v_order.product_id));
  RETURN v_order;
END;
$$;
REVOKE ALL ON FUNCTION public.respond_to_order(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_to_order(UUID, BOOLEAN, TEXT) TO authenticated;

-- Either side backs out before the item changes hands
CREATE OR REPLACE FUNCTION public.cancel_order(p_order_id UUID, p_reason TEXT DEFAULT '')
RETURNS public.orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order public.orders;
  v_me UUID := auth.uid();
  v_other UUID;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR (v_order.buyer_id IS DISTINCT FROM v_me AND v_order.seller_id IS DISTINCT FROM v_me) THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  IF v_order.status NOT IN ('pending', 'accepted') THEN
    RAISE EXCEPTION 'This order can no longer be cancelled (it is %)', v_order.status;
  END IF;
  IF v_me = v_order.seller_id AND v_order.status = 'pending' THEN
    RAISE EXCEPTION 'Decline the request instead';
  END IF;

  -- A reserved sale item goes back on the shelf
  IF v_order.order_type = 'sale' AND v_order.status = 'accepted' THEN
    UPDATE public.products SET status = 'available'
    WHERE id = v_order.product_id AND status = 'reserved';
  END IF;

  UPDATE public.orders
  SET status = 'cancelled',
      cancelled_at = NOW(),
      cancelled_by = v_me,
      decline_reason = LEFT(COALESCE(p_reason, ''), 300),
      payment_status = CASE WHEN payment_status = 'paid' THEN 'refund_pending' ELSE payment_status END
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  v_other := CASE WHEN v_me = v_order.buyer_id THEN v_order.seller_id ELSE v_order.buyer_id END;
  PERFORM public._notify(v_other, 'Order cancelled',
    '"' || v_order.product_title || '" was cancelled' ||
      CASE WHEN COALESCE(p_reason, '') <> '' THEN ': ' || LEFT(p_reason, 120) ELSE '' END, 'order',
    jsonb_build_object('orderId', v_order.id, 'productId', v_order.product_id));
  RETURN v_order;
END;
$$;
REVOKE ALL ON FUNCTION public.cancel_order(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_order(UUID, TEXT) TO authenticated;

-- The seller scans the buyer's QR: hands over a sale, starts a rental,
-- or (second scan) takes a rental back.
CREATE OR REPLACE FUNCTION public.scan_handover(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order public.orders;
  v_action TEXT;
  v_late_hours NUMERIC := 0;
  v_late_fee NUMERIC := 0;
BEGIN
  SELECT o.* INTO v_order
  FROM public.order_secrets s
  JOIN public.orders o ON o.id = s.order_id
  WHERE s.handover_code = UPPER(TRIM(p_code))
  FOR UPDATE OF o;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This code doesn''t match any order';
  END IF;
  IF v_order.seller_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Only the seller of this order can scan its code';
  END IF;

  -- Scanning a pending request accepts it on the spot
  IF v_order.status = 'pending' THEN
    v_order := public._accept_order(v_order.id);
  END IF;

  IF v_order.status = 'accepted' AND v_order.order_type = 'sale' THEN
    UPDATE public.products SET status = 'sold' WHERE id = v_order.product_id;
    UPDATE public.orders
    SET status = 'completed', picked_up_at = NOW(), completed_at = NOW()
    WHERE id = v_order.id RETURNING * INTO v_order;
    v_action := 'sale_completed';

  ELSIF v_order.status = 'accepted' THEN
    UPDATE public.orders SET status = 'active', picked_up_at = NOW()
    WHERE id = v_order.id RETURNING * INTO v_order;
    v_action := 'rental_started';

  ELSIF v_order.status = 'active' THEN
    -- One hour of grace, then the normal rate, pro-rated by the hour
    IF NOW() > v_order.end_at + INTERVAL '1 hour' THEN
      v_late_hours := CEIL(EXTRACT(EPOCH FROM (NOW() - v_order.end_at)) / 3600.0);
      v_late_fee := ROUND(v_late_hours * COALESCE(v_order.rate, 0) / public.rent_unit_hours(v_order.rent_unit));
    END IF;
    UPDATE public.orders
    SET status = 'completed', returned_at = NOW(), completed_at = NOW(), late_fee = v_late_fee
    WHERE id = v_order.id RETURNING * INTO v_order;
    v_action := 'rental_returned';

  ELSIF v_order.status = 'completed' THEN
    RAISE EXCEPTION 'This order is already completed';
  ELSE
    RAISE EXCEPTION 'This order was %', v_order.status;
  END IF;

  -- Online payments are held by the platform until the handover is done
  IF v_order.status = 'completed' AND v_order.payment_status = 'paid' THEN
    UPDATE public.profiles SET earnings = COALESCE(earnings, 0) + v_order.amount
    WHERE id = v_order.seller_id;
  END IF;

  PERFORM public._notify(v_order.buyer_id,
    CASE v_action
      WHEN 'sale_completed' THEN 'Purchase complete'
      WHEN 'rental_started' THEN 'Rental started'
      ELSE 'Return confirmed' END,
    CASE v_action
      WHEN 'sale_completed' THEN '"' || v_order.product_title || '" is yours. Leave the seller a review!'
      WHEN 'rental_started' THEN '"' || v_order.product_title || '" — return it by ' ||
        TO_CHAR(v_order.end_at AT TIME ZONE 'Asia/Kolkata', 'DD Mon, HH12:MI AM')
      ELSE '"' || v_order.product_title || '" is back with the owner' ||
        CASE WHEN v_late_fee > 0 THEN '. Late fee: ₹' || v_late_fee ELSE '.' END END,
    'order',
    jsonb_build_object('orderId', v_order.id, 'productId', v_order.product_id));

  RETURN jsonb_build_object('action', v_action, 'lateFee', v_late_fee, 'order', to_jsonb(v_order));
END;
$$;
REVOKE ALL ON FUNCTION public.scan_handover(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.scan_handover(TEXT) TO authenticated;

-- Booked slots of one listing — dates only, nothing about who booked them
CREATE OR REPLACE FUNCTION public.get_product_bookings(p_product_id UUID)
RETURNS TABLE (start_at TIMESTAMPTZ, end_at TIMESTAMPTZ, status TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.start_at, o.end_at, o.status
  FROM public.orders o
  WHERE o.product_id = p_product_id
    AND o.status IN ('accepted', 'active')
    AND o.end_at > NOW() - INTERVAL '1 day'
  ORDER BY o.start_at;
$$;

-- Rentals that are taken during a window ("Available today" filter)
CREATE OR REPLACE FUNCTION public.get_booked_product_ids(p_start TIMESTAMPTZ, p_end TIMESTAMPTZ)
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT o.product_id
  FROM public.orders o
  WHERE o.status IN ('accepted', 'active')
    AND o.product_id IS NOT NULL
    AND tstzrange(o.start_at, o.end_at) && tstzrange(p_start, p_end);
$$;


-- ====================================================================
-- 5. REVIEWS
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  rating NUMERIC(2, 1) NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS reviews_order_id_key ON public.reviews (order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS reviews_seller_idx ON public.reviews (seller_id, created_at DESC);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read reviews" ON public.reviews;
DROP POLICY IF EXISTS "Buyers can write reviews" ON public.reviews;

CREATE POLICY "Anyone can read reviews"
  ON public.reviews FOR SELECT USING (true);

-- Seller rating = average of their reviews
CREATE OR REPLACE FUNCTION public.refresh_seller_rating()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_seller UUID := COALESCE(NEW.seller_id, OLD.seller_id);
BEGIN
  UPDATE public.profiles p
  SET rating = COALESCE((SELECT ROUND(AVG(r.rating)::NUMERIC, 2) FROM public.reviews r WHERE r.seller_id = v_seller), 5),
      review_count = (SELECT COUNT(*) FROM public.reviews r WHERE r.seller_id = v_seller)
  WHERE p.id = v_seller;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS reviews_refresh_rating ON public.reviews;
CREATE TRIGGER reviews_refresh_rating
  AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.refresh_seller_rating();

-- One review per completed order, by its buyer
CREATE OR REPLACE FUNCTION public.submit_review(p_order_id UUID, p_rating NUMERIC, p_comment TEXT DEFAULT '')
RETURNS public.reviews
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order public.orders;
  v_review public.reviews;
  v_buyer_name TEXT;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND OR v_order.buyer_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  IF v_order.status <> 'completed' THEN
    RAISE EXCEPTION 'You can review once the handover is complete';
  END IF;
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;
  IF EXISTS (SELECT 1 FROM public.reviews WHERE order_id = p_order_id) THEN
    RAISE EXCEPTION 'You already reviewed this order';
  END IF;

  INSERT INTO public.reviews (seller_id, buyer_id, product_id, order_id, rating, comment)
  VALUES (v_order.seller_id, v_order.buyer_id, v_order.product_id, v_order.id,
          ROUND(p_rating * 2) / 2, LEFT(COALESCE(p_comment, ''), 1000))
  RETURNING * INTO v_review;

  SELECT COALESCE(NULLIF(display_name, ''), 'A buyer') INTO v_buyer_name FROM public.profiles WHERE id = v_order.buyer_id;
  PERFORM public._notify(v_order.seller_id, 'New ' || v_review.rating || '★ review',
    v_buyer_name || ' reviewed "' || v_order.product_title || '"', 'review',
    jsonb_build_object('orderId', v_order.id, 'productId', v_order.product_id));
  RETURN v_review;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_review(UUID, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_review(UUID, NUMERIC, TEXT) TO authenticated;


-- ====================================================================
-- 6. CHATS & MESSAGES
-- Room ids are "<uid>_<uid>" (sorted) so both sides land in the same
-- room; the id also seeds the per-room message encryption key.
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.chats (
  id TEXT PRIMARY KEY,
  participants UUID[] NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  last_message TEXT DEFAULT '',
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id TEXT NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id),
  text TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Policies must go before the column type change below
DROP POLICY IF EXISTS "Users can view chats they participate in" ON public.chats;
DROP POLICY IF EXISTS "Users can create chats they participate in" ON public.chats;
DROP POLICY IF EXISTS "Users can view messages in their chats" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages in their chats" ON public.messages;

-- The first version of this schema used UUID room ids
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'chats' AND column_name = 'id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_chat_id_fkey;
    ALTER TABLE public.chats ALTER COLUMN id DROP DEFAULT;
    ALTER TABLE public.chats ALTER COLUMN id TYPE TEXT USING id::TEXT;
    ALTER TABLE public.messages ALTER COLUMN chat_id TYPE TEXT USING chat_id::TEXT;
    ALTER TABLE public.messages ADD CONSTRAINT messages_chat_id_fkey
      FOREIGN KEY (chat_id) REFERENCES public.chats(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE public.chats ADD COLUMN IF NOT EXISTS participant_names JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.chats ADD COLUMN IF NOT EXISTS participant_avatars JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.chats ADD COLUMN IF NOT EXISTS product_title TEXT DEFAULT '';
ALTER TABLE public.chats ADD COLUMN IF NOT EXISTS last_sender_id UUID;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS sender_name TEXT DEFAULT '';

CREATE INDEX IF NOT EXISTS chats_participants_idx ON public.chats USING GIN (participants);
CREATE INDEX IF NOT EXISTS messages_chat_idx ON public.messages (chat_id, created_at);

ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view chats they participate in"
  ON public.chats FOR SELECT USING (auth.uid() = ANY(participants));

CREATE POLICY "Users can view messages in their chats"
  ON public.messages FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.chats c WHERE c.id = messages.chat_id AND auth.uid() = ANY(c.participants))
  );
CREATE POLICY "Users can send messages in their chats"
  ON public.messages FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (SELECT 1 FROM public.chats c WHERE c.id = messages.chat_id AND auth.uid() = ANY(c.participants))
  );

-- Opens (or reuses) the room between the caller and another user
CREATE OR REPLACE FUNCTION public.open_chat(p_other UUID, p_product_id UUID DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_me UUID := auth.uid();
  v_id TEXT;
  v_me_profile public.profiles;
  v_other_profile public.profiles;
  v_title TEXT := '';
  v_created BOOLEAN := FALSE;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Please sign in to chat';
  END IF;
  IF p_other IS NULL OR p_other = v_me THEN
    RAISE EXCEPTION 'You cannot chat with yourself';
  END IF;

  SELECT * INTO v_me_profile FROM public.profiles WHERE id = v_me;
  SELECT * INTO v_other_profile FROM public.profiles WHERE id = p_other;
  IF v_other_profile.id IS NULL THEN
    RAISE EXCEPTION 'That user no longer exists';
  END IF;
  IF p_product_id IS NOT NULL THEN
    SELECT title INTO v_title FROM public.products WHERE id = p_product_id;
  END IF;

  -- Same ordering as JavaScript's default string sort
  v_id := LEAST(v_me::TEXT COLLATE "C", p_other::TEXT COLLATE "C") || '_' ||
          GREATEST(v_me::TEXT COLLATE "C", p_other::TEXT COLLATE "C");

  INSERT INTO public.chats (id, participants, participant_names, participant_avatars, product_id, product_title)
  VALUES (
    v_id,
    ARRAY[v_me, p_other], -- [opener, other]: the buyer usually opens the room
    jsonb_build_object(v_me::TEXT, COALESCE(NULLIF(v_me_profile.display_name, ''), 'User'),
                       p_other::TEXT, COALESCE(NULLIF(v_other_profile.store_name, ''), NULLIF(v_other_profile.display_name, ''), 'User')),
    jsonb_build_object(v_me::TEXT, COALESCE(v_me_profile.avatar_url, ''),
                       p_other::TEXT, COALESCE(v_other_profile.avatar_url, '')),
    p_product_id, COALESCE(v_title, '')
  )
  ON CONFLICT (id) DO NOTHING;
  v_created := FOUND;

  IF NOT v_created AND p_product_id IS NOT NULL THEN
    -- Re-opening from another listing moves the room's context to it
    UPDATE public.chats SET product_id = p_product_id, product_title = COALESCE(v_title, '')
    WHERE id = v_id;
  END IF;

  IF v_created THEN
    PERFORM public._notify(p_other, 'New conversation',
      COALESCE(NULLIF(v_me_profile.display_name, ''), 'Someone') || ' messaged you' ||
        CASE WHEN v_title <> '' THEN ' about "' || v_title || '"' ELSE '' END,
      'inquiry', jsonb_build_object('chatId', v_id, 'productId', p_product_id));
  END IF;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.open_chat(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_chat(UUID, UUID) TO authenticated;

-- Keep the room preview fresh and nudge the other side (one unread
-- notification per room, refreshed instead of stacking up)
CREATE OR REPLACE FUNCTION public.handle_new_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_chat public.chats;
  v_recipient UUID;
  v_sender_name TEXT;
BEGIN
  UPDATE public.chats
  SET last_message = NEW.text, last_message_at = NEW.created_at, last_sender_id = NEW.sender_id
  WHERE id = NEW.chat_id
  RETURNING * INTO v_chat;

  SELECT p INTO v_recipient FROM UNNEST(v_chat.participants) AS p WHERE p <> NEW.sender_id LIMIT 1;
  IF v_recipient IS NULL THEN
    RETURN NEW;
  END IF;
  v_sender_name := COALESCE(NULLIF(NEW.sender_name, ''), v_chat.participant_names->>NEW.sender_id::TEXT, 'Someone');

  UPDATE public.notifications
  SET title = 'New message from ' || v_sender_name, created_at = NOW()
  WHERE user_id = v_recipient AND type = 'message' AND read = FALSE AND data->>'chatId' = NEW.chat_id;
  IF NOT FOUND THEN
    PERFORM public._notify(v_recipient, 'New message from ' || v_sender_name,
      CASE WHEN v_chat.product_title <> '' THEN 'About "' || v_chat.product_title || '"' ELSE 'Open the chat to reply' END,
      'message', jsonb_build_object('chatId', NEW.chat_id));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_message_created ON public.messages;
CREATE TRIGGER on_message_created
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_message();


-- ====================================================================
-- 7. REPORTS
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  seller_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users file reports" ON public.reports;
DROP POLICY IF EXISTS "Users read their reports" ON public.reports;

CREATE POLICY "Users file reports"
  ON public.reports FOR INSERT WITH CHECK (auth.uid() = reporter_id AND status = 'pending');
CREATE POLICY "Users read their reports"
  ON public.reports FOR SELECT USING (auth.uid() = reporter_id);


-- ====================================================================
-- 8. KYC (sensitive fields arrive already encrypted by /api/kyc/submit)
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.kyc_submissions (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  status TEXT DEFAULT 'PENDING_VERIFICATION',
  rejection_reason TEXT DEFAULT '',
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID
);

CREATE TABLE IF NOT EXISTS public.kyc_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_uid UUID NOT NULL,
  admin_uid UUID,
  action TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.kyc_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read their KYC" ON public.kyc_submissions;
CREATE POLICY "Users read their KYC"
  ON public.kyc_submissions FOR SELECT USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT is_admin FROM public.profiles WHERE id = auth.uid()), FALSE);
$$;

CREATE OR REPLACE FUNCTION public.submit_kyc(p_data JSONB)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_doc TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Please sign in';
  END IF;
  IF (SELECT kyc_status FROM public.profiles WHERE id = auth.uid()) = 'VERIFIED' THEN
    RAISE EXCEPTION 'Your KYC is already verified';
  END IF;
  IF COALESCE(p_data->'identity'->>'aadhaarNumber', '') = '' THEN
    RAISE EXCEPTION 'Your Aadhaar number is required';
  END IF;
  -- The selfie and ID photo must be files this user uploaded to the private bucket
  FOREACH v_doc IN ARRAY ARRAY['selfie', 'idFront'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM storage.objects o
      WHERE o.bucket_id = 'kyc-docs'
        AND o.name = p_data->'documents'->>v_doc
        AND (storage.foldername(o.name))[1] = auth.uid()::TEXT
    ) THEN
      RAISE EXCEPTION '%', CASE v_doc WHEN 'selfie' THEN 'Upload your selfie before submitting'
                                      ELSE 'Upload a photo of your ID before submitting' END;
    END IF;
  END LOOP;

  INSERT INTO public.kyc_submissions (user_id, data, status, rejection_reason, submitted_at, reviewed_at, reviewed_by)
  VALUES (auth.uid(), p_data, 'PENDING_VERIFICATION', '', NOW(), NULL, NULL)
  ON CONFLICT (user_id) DO UPDATE
    SET data = EXCLUDED.data, status = 'PENDING_VERIFICATION', rejection_reason = '',
        submitted_at = NOW(), reviewed_at = NULL, reviewed_by = NULL;
  UPDATE public.profiles SET kyc_status = 'PENDING_VERIFICATION', kyc_rejection_reason = ''
  WHERE id = auth.uid();
  PERFORM public._notify(auth.uid(), 'Verification submitted',
    'We''re checking your ID — usually within 24 hours. You can set up your shop meanwhile.', 'kyc', '{}'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.submit_kyc(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_kyc(JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_kyc()
RETURNS TABLE (user_id UUID, email TEXT, display_name TEXT, kyc_status TEXT, data JSONB, submitted_at TIMESTAMPTZ)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  RETURN QUERY
    SELECT k.user_id, p.email, p.display_name, p.kyc_status, k.data, k.submitted_at
    FROM public.kyc_submissions k JOIN public.profiles p ON p.id = k.user_id
    WHERE k.status = 'PENDING_VERIFICATION'
    ORDER BY k.submitted_at;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_kyc() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_kyc() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_review_kyc(p_user_id UUID, p_approve BOOLEAN, p_reason TEXT DEFAULT '')
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF NOT p_approve AND COALESCE(p_reason, '') = '' THEN
    RAISE EXCEPTION 'A rejection reason is required';
  END IF;
  UPDATE public.kyc_submissions
  SET status = CASE WHEN p_approve THEN 'VERIFIED' ELSE 'REJECTED' END,
      rejection_reason = CASE WHEN p_approve THEN '' ELSE p_reason END,
      reviewed_at = NOW(), reviewed_by = auth.uid()
  WHERE user_id = p_user_id;
  UPDATE public.profiles
  SET kyc_status = CASE WHEN p_approve THEN 'VERIFIED' ELSE 'REJECTED' END,
      kyc_rejection_reason = CASE WHEN p_approve THEN '' ELSE p_reason END
  WHERE id = p_user_id;
  INSERT INTO public.kyc_audit_logs (target_uid, admin_uid, action, reason)
  VALUES (p_user_id, auth.uid(), CASE WHEN p_approve THEN 'APPROVE' ELSE 'REJECT' END, NULLIF(p_reason, ''));
  PERFORM public._notify(p_user_id,
    CASE WHEN p_approve THEN 'KYC verified' ELSE 'KYC needs attention' END,
    CASE WHEN p_approve THEN 'You now have the Verified badge.' ELSE p_reason END, 'kyc', '{}'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_review_kyc(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_kyc(UUID, BOOLEAN, TEXT) TO authenticated;


-- ====================================================================
-- 9. PAYOUTS (only balances from online payments are withdrawable;
--    pay-at-pickup money goes straight to the seller)
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  payout_method TEXT NOT NULL,
  destination TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sellers read their withdrawals" ON public.withdrawals;
CREATE POLICY "Sellers read their withdrawals"
  ON public.withdrawals FOR SELECT USING (auth.uid() = seller_id);

CREATE OR REPLACE FUNCTION public.request_withdrawal(p_amount NUMERIC, p_method TEXT, p_destination TEXT)
RETURNS public.withdrawals
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_balance NUMERIC;
  v_row public.withdrawals;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Please sign in';
  END IF;
  IF p_amount IS NULL OR p_amount < 50 THEN
    RAISE EXCEPTION 'Minimum withdrawal amount is ₹50';
  END IF;
  IF p_method NOT IN ('upi', 'bank_transfer') THEN
    RAISE EXCEPTION 'Choose UPI or bank transfer';
  END IF;
  IF LENGTH(TRIM(COALESCE(p_destination, ''))) < 4 THEN
    RAISE EXCEPTION 'Enter a valid UPI ID or bank account';
  END IF;

  SELECT COALESCE(earnings, 0) INTO v_balance FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance. Available: ₹%', v_balance;
  END IF;

  UPDATE public.profiles SET earnings = earnings - p_amount WHERE id = auth.uid();
  INSERT INTO public.withdrawals (seller_id, amount, payout_method, destination)
  VALUES (auth.uid(), p_amount, p_method, TRIM(p_destination))
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.request_withdrawal(NUMERIC, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(NUMERIC, TEXT, TEXT) TO authenticated;


-- ====================================================================
-- 10. PAYMENTS LOG (service role only — written by the Razorpay routes)
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.payments (
  razorpay_payment_id TEXT PRIMARY KEY,
  razorpay_order_id TEXT,
  user_id UUID,
  amount NUMERIC(12, 2),
  kind TEXT, -- 'order' | 'print_order'
  status TEXT,
  notes JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;


-- ====================================================================
-- 11. PRINT & XEROX ORDERS
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.print_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  buyer_name TEXT DEFAULT '',
  buyer_phone TEXT DEFAULT '',
  provider_name TEXT DEFAULT '',
  provider_avatar TEXT DEFAULT '',
  file_paths TEXT[] DEFAULT '{}', -- objects in the private "print-docs" bucket
  file_names TEXT[] DEFAULT '{}',
  copies INTEGER NOT NULL DEFAULT 1 CHECK (copies BETWEEN 1 AND 500),
  page_count INTEGER NOT NULL DEFAULT 1 CHECK (page_count BETWEEN 1 AND 5000),
  color_mode TEXT DEFAULT 'bw',
  paper_size TEXT DEFAULT 'A4',
  orientation TEXT DEFAULT 'portrait',
  sides TEXT DEFAULT 'single',
  special_instructions TEXT DEFAULT '',
  delivery_address TEXT DEFAULT '',
  total_amount NUMERIC(10, 2) NOT NULL,
  status TEXT DEFAULT 'pending', -- pending → accepted → printing → out_for_delivery → completed | declined | cancelled
  payment_method TEXT DEFAULT 'pay_on_delivery', -- 'pay_on_delivery' | 'online'
  payment_status TEXT DEFAULT 'unpaid',
  payment_id TEXT DEFAULT '',
  razorpay_order_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS print_orders_buyer_idx ON public.print_orders (buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS print_orders_provider_idx ON public.print_orders (provider_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS print_orders_payment_id_key ON public.print_orders (payment_id)
  WHERE payment_id IS NOT NULL AND payment_id <> '';

ALTER TABLE public.print_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Parties read print orders" ON public.print_orders;
CREATE POLICY "Parties read print orders"
  ON public.print_orders FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = provider_id);

DROP TRIGGER IF EXISTS print_orders_set_updated_at ON public.print_orders;
CREATE TRIGGER print_orders_set_updated_at
  BEFORE UPDATE ON public.print_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public._place_print_order(
  p_buyer UUID, p_provider_id UUID, p_file_paths TEXT[], p_file_names TEXT[],
  p_copies INTEGER, p_page_count INTEGER, p_color_mode TEXT, p_paper_size TEXT,
  p_orientation TEXT, p_sides TEXT, p_instructions TEXT, p_address TEXT, p_phone TEXT,
  p_payment_method TEXT, p_payment_status TEXT, p_payment_id TEXT, p_razorpay_order_id TEXT,
  p_expected_amount NUMERIC
) RETURNS public.print_orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_provider public.profiles;
  v_buyer public.profiles;
  v_total NUMERIC;
  v_row public.print_orders;
BEGIN
  IF p_buyer IS NULL THEN
    RAISE EXCEPTION 'Please sign in';
  END IF;
  SELECT * INTO v_provider FROM public.profiles WHERE id = p_provider_id;
  IF NOT FOUND OR NOT COALESCE(v_provider.is_print_provider, FALSE) THEN
    RAISE EXCEPTION 'This print shop is not taking orders';
  END IF;
  IF p_provider_id = p_buyer THEN
    RAISE EXCEPTION 'You cannot order prints from your own shop';
  END IF;
  IF COALESCE(array_length(p_file_paths, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Upload at least one document';
  END IF;

  v_total := GREATEST(1, ROUND(
    CASE WHEN p_color_mode = 'color' THEN v_provider.print_price_color ELSE v_provider.print_price_bw END
    * GREATEST(1, p_page_count) * GREATEST(1, p_copies), 2));
  IF p_expected_amount IS NOT NULL AND p_expected_amount <> v_total THEN
    RAISE EXCEPTION 'The price changed — please review and try again';
  END IF;

  SELECT * INTO v_buyer FROM public.profiles WHERE id = p_buyer;

  INSERT INTO public.print_orders (
    provider_id, buyer_id, buyer_name, buyer_phone, provider_name, provider_avatar,
    file_paths, file_names, copies, page_count, color_mode, paper_size, orientation, sides,
    special_instructions, delivery_address, total_amount,
    payment_method, payment_status, payment_id, razorpay_order_id
  ) VALUES (
    p_provider_id, p_buyer, COALESCE(v_buyer.display_name, ''), COALESCE(NULLIF(p_phone, ''), v_buyer.phone, ''),
    COALESCE(NULLIF(v_provider.print_store_name, ''), NULLIF(v_provider.store_name, ''), v_provider.display_name),
    COALESCE(v_provider.avatar_url, ''),
    p_file_paths, COALESCE(p_file_names, '{}'), GREATEST(1, p_copies), GREATEST(1, p_page_count),
    CASE WHEN p_color_mode = 'color' THEN 'color' ELSE 'bw' END,
    COALESCE(NULLIF(p_paper_size, ''), 'A4'), COALESCE(NULLIF(p_orientation, ''), 'portrait'),
    CASE WHEN p_sides = 'double' THEN 'double' ELSE 'single' END,
    LEFT(COALESCE(p_instructions, ''), 1000), LEFT(COALESCE(p_address, ''), 500), v_total,
    p_payment_method, p_payment_status, COALESCE(p_payment_id, ''), p_razorpay_order_id
  ) RETURNING * INTO v_row;

  PERFORM public._notify(p_provider_id, 'New print order',
    COALESCE(NULLIF(v_buyer.display_name, ''), 'A customer') || ' sent ' || v_row.page_count || ' page(s) × ' ||
      v_row.copies || ' — ₹' || v_total, 'print_order', jsonb_build_object('printOrderId', v_row.id));
  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public._place_print_order(UUID, UUID, TEXT[], TEXT[], INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_print_order(
  p_provider_id UUID, p_file_paths TEXT[], p_file_names TEXT[],
  p_copies INTEGER, p_page_count INTEGER, p_color_mode TEXT, p_paper_size TEXT,
  p_orientation TEXT, p_sides TEXT, p_instructions TEXT, p_address TEXT, p_phone TEXT
) RETURNS public.print_orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN public._place_print_order(auth.uid(), p_provider_id, p_file_paths, p_file_names,
    p_copies, p_page_count, p_color_mode, p_paper_size, p_orientation, p_sides,
    p_instructions, p_address, p_phone, 'pay_on_delivery', 'unpaid', NULL, NULL, NULL);
END;
$$;
REVOKE ALL ON FUNCTION public.create_print_order(UUID, TEXT[], TEXT[], INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_print_order(UUID, TEXT[], TEXT[], INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_paid_print_order(
  p_buyer UUID, p_provider_id UUID, p_file_paths TEXT[], p_file_names TEXT[],
  p_copies INTEGER, p_page_count INTEGER, p_color_mode TEXT, p_paper_size TEXT,
  p_orientation TEXT, p_sides TEXT, p_instructions TEXT, p_address TEXT, p_phone TEXT,
  p_amount NUMERIC, p_payment_id TEXT, p_razorpay_order_id TEXT
) RETURNS public.print_orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_existing public.print_orders;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('lendly_payment:' || p_payment_id));
  SELECT * INTO v_existing FROM public.print_orders WHERE payment_id = p_payment_id;
  IF FOUND THEN
    RETURN v_existing;
  END IF;
  RETURN public._place_print_order(p_buyer, p_provider_id, p_file_paths, p_file_names,
    p_copies, p_page_count, p_color_mode, p_paper_size, p_orientation, p_sides,
    p_instructions, p_address, p_phone, 'online', 'paid', p_payment_id, p_razorpay_order_id, p_amount);
END;
$$;
REVOKE ALL ON FUNCTION public.create_paid_print_order(UUID, UUID, TEXT[], TEXT[], INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_paid_print_order(UUID, UUID, TEXT[], TEXT[], INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT) TO service_role;

-- Provider moves a job along; the buyer can cancel while it's still pending
CREATE OR REPLACE FUNCTION public.update_print_order_status(p_id UUID, p_status TEXT)
RETURNS public.print_orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.print_orders;
  v_allowed BOOLEAN;
BEGIN
  SELECT * INTO v_row FROM public.print_orders WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR (v_row.provider_id IS DISTINCT FROM auth.uid() AND v_row.buyer_id IS DISTINCT FROM auth.uid()) THEN
    RAISE EXCEPTION 'Print order not found';
  END IF;

  IF auth.uid() = v_row.buyer_id AND auth.uid() <> v_row.provider_id THEN
    v_allowed := p_status = 'cancelled' AND v_row.status = 'pending';
  ELSE
    v_allowed := (v_row.status, p_status) IN (
      ('pending', 'accepted'), ('pending', 'declined'),
      ('accepted', 'printing'), ('printing', 'out_for_delivery'),
      ('printing', 'completed'), ('out_for_delivery', 'completed'));
  END IF;
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Can''t move a % print order to %', v_row.status, p_status;
  END IF;

  UPDATE public.print_orders
  SET status = p_status,
      payment_status = CASE
        WHEN p_status IN ('cancelled', 'declined') AND payment_status = 'paid' THEN 'refund_pending'
        WHEN p_status = 'completed' AND payment_method = 'pay_on_delivery' THEN 'paid'
        ELSE payment_status END
  WHERE id = p_id
  RETURNING * INTO v_row;

  IF p_status = 'completed' AND v_row.payment_method = 'online' THEN
    UPDATE public.profiles SET earnings = COALESCE(earnings, 0) + v_row.total_amount WHERE id = v_row.provider_id;
  END IF;

  PERFORM public._notify(
    CASE WHEN auth.uid() = v_row.provider_id THEN v_row.buyer_id ELSE v_row.provider_id END,
    'Print order ' || REPLACE(p_status, '_', ' '),
    v_row.page_count || ' page(s) × ' || v_row.copies || ' — ₹' || v_row.total_amount,
    'print_order', jsonb_build_object('printOrderId', v_row.id));
  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.update_print_order_status(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_print_order_status(UUID, TEXT) TO authenticated;


-- ====================================================================
-- 12. FOLLOWS & BACK-IN-STOCK ALERTS
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.seller_follows (
  follower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (follower_id, seller_id),
  CHECK (follower_id <> seller_id)
);

CREATE TABLE IF NOT EXISTS public.stock_alerts (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, product_id)
);

ALTER TABLE public.seller_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage who they follow" ON public.seller_follows;
DROP POLICY IF EXISTS "Users manage their stock alerts" ON public.stock_alerts;

CREATE POLICY "Users manage who they follow"
  ON public.seller_follows FOR ALL USING (auth.uid() = follower_id) WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users manage their stock alerts"
  ON public.stock_alerts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Followers hear about new listings
CREATE OR REPLACE FUNCTION public.notify_followers_of_listing()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_store TEXT;
BEGIN
  SELECT COALESCE(NULLIF(store_name, ''), display_name, 'A shop you follow') INTO v_store
  FROM public.profiles WHERE id = NEW.seller_id;
  INSERT INTO public.notifications (user_id, title, body, type, data)
  SELECT f.follower_id, 'New from ' || v_store, NEW.title, 'new_product',
         jsonb_build_object('productId', NEW.id)
  FROM public.seller_follows f WHERE f.seller_id = NEW.seller_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_product_created_notify ON public.products;
CREATE TRIGGER on_product_created_notify
  AFTER INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.notify_followers_of_listing();

-- Alerts fire once, when a listing becomes available again
CREATE OR REPLACE FUNCTION public.notify_back_in_stock()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'available' AND OLD.status IS DISTINCT FROM 'available' THEN
    INSERT INTO public.notifications (user_id, title, body, type, data)
    SELECT a.user_id, 'Back in stock', NEW.title || ' is available again', 'back_in_stock',
           jsonb_build_object('productId', NEW.id)
    FROM public.stock_alerts a WHERE a.product_id = NEW.id;
    DELETE FROM public.stock_alerts WHERE product_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_product_back_in_stock ON public.products;
CREATE TRIGGER on_product_back_in_stock
  AFTER UPDATE OF status ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.notify_back_in_stock();


-- ====================================================================
-- 13. STORAGE
--   media      — public: listing photos, avatars, covers  ({uid}/...)
--   print-docs — private: documents sent to a print shop  ({providerId}/{buyerId}/...)
--   kyc-docs   — private: lender ID photos and selfies    ({uid}/...), owner and admins only
-- ====================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('media', 'media', TRUE, 10485760,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/heic'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('print-docs', 'print-docs', FALSE, 26214400)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS "media: owners upload" ON storage.objects;
DROP POLICY IF EXISTS "media: owners update" ON storage.objects;
DROP POLICY IF EXISTS "media: owners delete" ON storage.objects;
DROP POLICY IF EXISTS "print-docs: buyers upload" ON storage.objects;
DROP POLICY IF EXISTS "print-docs: parties read" ON storage.objects;

CREATE POLICY "media: owners upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'media' AND (storage.foldername(name))[1] = auth.uid()::TEXT);
CREATE POLICY "media: owners update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'media' AND (storage.foldername(name))[1] = auth.uid()::TEXT);
CREATE POLICY "media: owners delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'media' AND (storage.foldername(name))[1] = auth.uid()::TEXT);

CREATE POLICY "print-docs: buyers upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'print-docs' AND (storage.foldername(name))[2] = auth.uid()::TEXT);
CREATE POLICY "print-docs: parties read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'print-docs' AND auth.uid()::TEXT IN ((storage.foldername(name))[1], (storage.foldername(name))[2]));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('kyc-docs', 'kyc-docs', FALSE, 10485760,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "kyc-docs: owners upload" ON storage.objects;
DROP POLICY IF EXISTS "kyc-docs: owners and admins read" ON storage.objects;

-- No update or delete: a submitted document can't be swapped out after review
CREATE POLICY "kyc-docs: owners upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'kyc-docs' AND (storage.foldername(name))[1] = auth.uid()::TEXT);
CREATE POLICY "kyc-docs: owners and admins read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'kyc-docs' AND ((storage.foldername(name))[1] = auth.uid()::TEXT OR public.is_admin()));


-- ====================================================================
-- 14. REALTIME (chat, notifications, live order status)
-- ====================================================================

DO $$
DECLARE
  t TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY['messages', 'chats', 'notifications', 'orders', 'print_orders'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    END LOOP;
  END IF;
END $$;
