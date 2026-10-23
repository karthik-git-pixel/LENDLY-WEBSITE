-- ====================================================================
-- Lendly DEMO DATA — 8 shops and 40 listings around Kochi
--
-- For local demos and screenshots only; don't run it on a live
-- marketplace. Run supabase/schema.sql first, then this file, in the
-- Supabase SQL Editor. Safe to re-run (fixed ids, ON CONFLICT DO NOTHING).
--
-- The demo shops are real auth users without a password, so nobody can
-- sign in as them. To remove everything again:
--   DELETE FROM public.orders  WHERE seller_id IN (SELECT id FROM auth.users WHERE email LIKE '%@demo.lendly.app')
--                                 OR buyer_id  IN (SELECT id FROM auth.users WHERE email LIKE '%@demo.lendly.app');
--   DELETE FROM auth.users WHERE email LIKE '%@demo.lendly.app';
-- ====================================================================
-- Ensure storefront columns exist in case profiles table was created with an older schema
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS store_category TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS store_hours JSONB;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

BEGIN;

-- 1. Accounts: 8 shops + 2 reviewers (profiles are created by the signup trigger)
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
SELECT
  '00000000-0000-0000-0000-000000000000', u.id::uuid, 'authenticated', 'authenticated', u.email, '', NOW(),
  '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', u.name), NOW(), NOW(),
  '', '', '', ''
FROM (VALUES
  ('d0000000-0000-4000-8000-000000000001', 'beatbox@demo.lendly.app',      'Beat Box Sound & Lights'),
  ('d0000000-0000-4000-8000-000000000002', 'grandleela@demo.lendly.app',   'Grand Leela Convention Centre'),
  ('d0000000-0000-4000-8000-000000000003', 'shutter@demo.lendly.app',      'Shutter Rentals'),
  ('d0000000-0000-4000-8000-000000000004', 'pedalride@demo.lendly.app',    'Pedal & Ride'),
  ('d0000000-0000-4000-8000-000000000005', 'campuscorner@demo.lendly.app', 'Campus Corner Books'),
  ('d0000000-0000-4000-8000-000000000006', 'eventdecor@demo.lendly.app',   'Kochi Event Decor & Tents'),
  ('d0000000-0000-4000-8000-000000000007', 'urbanthreads@demo.lendly.app', 'Urban Threads'),
  ('d0000000-0000-4000-8000-000000000008', 'homenest@demo.lendly.app',     'HomeNest Furniture'),
  ('d0000000-0000-4000-8000-0000000000b1', 'anjali@demo.lendly.app',       'Anjali Menon'),
  ('d0000000-0000-4000-8000-0000000000b2', 'rahul@demo.lendly.app',        'Rahul Varghese')
) AS u(id, email, name)
ON CONFLICT (id) DO NOTHING;

-- 2. Storefronts
UPDATE public.profiles p
SET is_seller = TRUE,
    display_name = s.name,
    store_name = s.name,
    store_category = s.category,
    store_description = s.about,
    store_location = jsonb_build_object('lat', s.lat, 'lng', s.lng, 'address', s.address),
    location = jsonb_build_object('lat', s.lat, 'lng', s.lng, 'address', s.address),
    store_hours = s.hours::jsonb,
    cover_url = 'https://images.unsplash.com/' || s.cover || '?w=1200&q=70&auto=format&fit=crop',
    avatar_url = 'https://images.unsplash.com/' || s.logo || '?w=160&h=160&q=70&auto=format&fit=crop',
    kyc_status = CASE WHEN s.verified THEN 'VERIFIED' ELSE 'NOT_STARTED' END
FROM (VALUES
  ('d0000000-0000-4000-8000-000000000001'::uuid, 'Beat Box Sound & Lights', 'Sound & Lights',
   'PA systems, DJ consoles and stage lighting for college fests, weddings and parties. Delivery and setup across Kochi.',
   10.0531, 76.3185, 'Kalamassery, Kochi', '{"open":"09:00","close":"21:00"}', 'photo-1514525253161-7a46d19cd819', 'photo-1545454675-3531b543be5d', TRUE),
  ('d0000000-0000-4000-8000-000000000002'::uuid, 'Grand Leela Convention Centre', 'Halls & Venues',
   'Banquet, party and conference halls with parking, in-house kitchen and power backup.',
   10.0261, 76.3086, 'Edappally, Kochi', '{"open":"08:00","close":"22:00"}', 'photo-1519167758481-83f550bb49b3', 'photo-1464366400600-7168b8af9bc3', TRUE),
  ('d0000000-0000-4000-8000-000000000003'::uuid, 'Shutter Rentals', 'Cameras & Drones',
   'DSLRs, lenses, drones and projectors by the day. Every kit is cleaned and tested before pickup.',
   10.0159, 76.3419, 'Kakkanad, Kochi', '{"open":"10:00","close":"20:00"}', 'photo-1516035069371-29a1b244cc32', 'photo-1502920917128-1aa500764cbd', TRUE),
  ('d0000000-0000-4000-8000-000000000004'::uuid, 'Pedal & Ride', 'Bikes & Cycles',
   'Cycles, motorbikes and tools to rent by the day, plus a few pre-owned bikes for sale.',
   10.0021, 76.3034, 'Palarivattom, Kochi', '{"open":"07:00","close":"20:00"}', 'photo-1528698827591-e19ccd7bc23d', 'photo-1485965120184-e220f721d03e', FALSE),
  ('d0000000-0000-4000-8000-000000000005'::uuid, 'Campus Corner Books', 'Books & Gadgets',
   'Second-hand textbooks, novels and student laptops near CUSAT.',
   10.0447, 76.3256, 'CUSAT, Kalamassery', '{"open":"09:30","close":"19:30","closed_days":[0]}', 'photo-1524995997946-a1c2e315a42f', 'photo-1497633762265-9d179a990aa6', FALSE),
  ('d0000000-0000-4000-8000-000000000006'::uuid, 'Kochi Event Decor & Tents', 'Seating, Decor & Tents',
   'Banquet chairs, round tables, floral decor and wedding cars for functions of any size.',
   9.9673, 76.3205, 'Vyttila, Kochi', '{"open":"08:00","close":"21:00"}', 'photo-1530023367847-a683933f4172', 'photo-1519225421980-715cb0215aed', TRUE),
  ('d0000000-0000-4000-8000-000000000007'::uuid, 'Urban Threads', 'Ethnic Wear',
   'Silk sarees and designer outfits on rent for weddings and functions.',
   9.9675, 76.2850, 'MG Road, Ernakulam', '{"open":"10:00","close":"21:00"}', 'photo-1567401893414-76b7b1e5a7a5', 'photo-1610030469983-98e550d6193c', FALSE),
  ('d0000000-0000-4000-8000-000000000008'::uuid, 'HomeNest Furniture', 'Furniture & Appliances',
   'Furniture and appliances for students and new families: buy outright or rent monthly.',
   9.9971, 76.2996, 'Kaloor, Kochi', '{"open":"10:00","close":"20:00"}', 'photo-1441986300917-64674bd600d8', 'photo-1555041469-a586c61ea9bc', TRUE)
) AS s(id, name, category, about, lat, lng, address, hours, cover, logo, verified)
WHERE p.id = s.id;

-- 3. Listings (photos: Unsplash)
INSERT INTO public.products (
  id, seller_id, title, description, price, category, subcategory, condition, images, location,
  status, listing_type, rent_duration, security_deposit, min_units, max_units, capacity, features, attributes,
  views, created_at
)
SELECT
  l.id::uuid, l.seller::uuid, l.title, l.description, l.price, l.category, l.subcategory, l.condition,
  ARRAY['https://images.unsplash.com/' || l.photo || '?w=900&q=70&auto=format&fit=crop'],
  jsonb_build_object('lat', p.lat + l.dlat, 'lng', p.lng + l.dlng, 'address', p.address),
  'available', l.kind, l.unit, l.deposit, l.min_units, l.max_units, l.capacity, l.features, l.attributes::jsonb,
  l.views, NOW() - make_interval(days => l.age_days)
FROM (VALUES
  -- Beat Box Sound & Lights (Kalamassery)
  ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'JBL PA speaker set (2 × 15") with mixer',
   'Two 15-inch JBL tops, a 4-channel mixer, stands and cabling. Comfortably covers 200–300 people indoors.',
   2500, 'Event & Sound', 'Sound & DJ', '', 'photo-1545454675-3531b543be5d', 'rent', 'day', 3000, 1, 7, NULL::int,
   ARRAY['Delivery available', 'Setup included', 'Mixer included'], '{"power":"2000 W"}', 142, 3, 0.0004, -0.0003),
  ('e0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001', 'Pioneer DJ console with DJ',
   'Pioneer DDJ controller with an experienced DJ for up to 6 hours. Playlist planning call included.',
   4000, 'Event & Sound', 'Sound & DJ', '', 'photo-1470225620780-dba8ba36b745', 'rent', 'day', 5000, 1, 3, NULL,
   ARRAY['Operator included', 'DJ console'], '{}', 98, 8, -0.0005, 0.0002),
  ('e0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000001', 'Wireless mic kit (4 handheld)',
   'Four UHF wireless handhelds with receiver and spare batteries.',
   600, 'Event & Sound', 'Sound & DJ', '', 'photo-1516280440614-37939bbacd81', 'rent', 'day', 1000, 1, 14, NULL,
   ARRAY['Wireless mics'], '{}', 64, 12, 0.0002, 0.0005),
  ('e0000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000001', 'Stage light package — 12 LED pars + 2 moving heads',
   'DMX-controlled LED pars, two moving heads and a haze machine. Technician sets up and runs the show.',
   3500, 'Event & Sound', 'Lighting', '', 'photo-1514525253161-7a46d19cd819', 'rent', 'day', 4000, 1, 5, NULL,
   ARRAY['LED par lights', 'Moving heads', 'DMX control', 'Setup included'], '{"fixtures":"14 lights"}', 121, 2, -0.0002, -0.0006),
  ('e0000000-0000-4000-8000-000000000005', 'd0000000-0000-4000-8000-000000000001', 'Balloon & confetti party decor',
   'Balloon arch, confetti cannons and a name banner. Set up 2 hours before your party.',
   1800, 'Event & Sound', 'Stage & Decor', '', 'photo-1530103862676-de8c9debad1d', 'rent', 'day', 0, 1, 1, NULL,
   ARRAY['Setup included', 'Backdrop'], '{}', 57, 5, 0.0006, 0.0001),
  ('e0000000-0000-4000-8000-000000000006', 'd0000000-0000-4000-8000-000000000001', 'JBL Flip 5 portable speaker',
   'Waterproof Bluetooth speaker, 12-hour battery. Great for picnics and small get-togethers.',
   250, 'Event & Sound', 'Sound & DJ', '', 'photo-1608043152269-423dbba4e7e1', 'rent', 'day', 1000, 1, 14, NULL,
   ARRAY['Pickup only'], '{}', 88, 16, -0.0006, 0.0004),
  ('e0000000-0000-4000-8000-000000000007', 'd0000000-0000-4000-8000-000000000001', 'Rode studio condenser mic',
   'Barely used Rode condenser mic with shock mount and pop filter.',
   4500, 'Electronics', 'TV & Audio', 'Like new', 'photo-1590602847861-f357a9332bbc', 'sale', 'day', 0, 1, NULL, NULL,
   ARRAY[]::text[], '{}', 31, 9, 0.0003, -0.0001),

  -- Grand Leela Convention Centre (Edappally)
  ('e0000000-0000-4000-8000-000000000008', 'd0000000-0000-4000-8000-000000000002', 'Grand banquet hall — up to 500 guests',
   'Fully air-conditioned hall with stage, green room, in-house kitchen, dining for 250 and parking for 120 cars.',
   45000, 'Event & Sound', 'Halls & Venues', '', 'photo-1519167758481-83f550bb49b3', 'rent', 'day', 10000, 1, 3, 500,
   ARRAY['AC', 'Parking', 'Stage', 'Kitchen', 'Dining area', 'Power backup'], '{}', 210, 6, 0.0003, 0.0002),
  ('e0000000-0000-4000-8000-000000000009', 'd0000000-0000-4000-8000-000000000002', 'Party hall — 80 guests',
   'Cosy hall for birthdays and get-togethers. Tables and chairs included; bring your own caterer.',
   2500, 'Event & Sound', 'Halls & Venues', '', 'photo-1464366400600-7168b8af9bc3', 'rent', 'hour', 3000, 3, 12, 80,
   ARRAY['AC', 'Parking', 'Power backup'], '{}', 133, 11, -0.0003, 0.0004),
  ('e0000000-0000-4000-8000-000000000010', 'd0000000-0000-4000-8000-000000000002', 'Conference hall with projector — 150 seats',
   'Theatre seating, projector, PA and high-speed Wi-Fi. Ideal for seminars and college events.',
   1800, 'Event & Sound', 'Halls & Venues', '', 'photo-1540575467063-178a50c2df87', 'rent', 'hour', 2000, 2, 10, 150,
   ARRAY['AC', 'Parking', 'Power backup'], '{}', 76, 19, 0.0001, -0.0005),

  -- Shutter Rentals (Kakkanad)
  ('e0000000-0000-4000-8000-000000000011', 'd0000000-0000-4000-8000-000000000003', 'Canon EOS 200D with 18-55mm lens',
   '24 MP DSLR, two batteries, 64 GB card and a padded bag. Perfect for trips and family functions.',
   800, 'Electronics', 'Cameras & Lenses', '', 'photo-1502920917128-1aa500764cbd', 'rent', 'day', 5000, 1, 14, NULL,
   ARRAY['Extra battery', 'Memory card'], '{}', 167, 4, 0.0002, 0.0003),
  ('e0000000-0000-4000-8000-000000000012', 'd0000000-0000-4000-8000-000000000003', 'Sony FE 50mm f/1.8 lens',
   'Sharp portrait prime for Sony E-mount bodies.',
   350, 'Electronics', 'Cameras & Lenses', '', 'photo-1516035069371-29a1b244cc32', 'rent', 'day', 2000, 1, 14, NULL,
   ARRAY[]::text[], '{}', 54, 13, -0.0004, 0.0001),
  ('e0000000-0000-4000-8000-000000000013', 'd0000000-0000-4000-8000-000000000003', 'DJI drone with licensed pilot',
   'Aerial photos and 4K video for weddings and events, edited highlights within 48 hours.',
   3000, 'Event & Sound', 'Photo & Video', '', 'photo-1473968512647-3e447244af8f', 'rent', 'day', 0, 1, 2, NULL,
   ARRAY['Operator included'], '{}', 92, 7, 0.0005, -0.0002),
  ('e0000000-0000-4000-8000-000000000014', 'd0000000-0000-4000-8000-000000000003', 'Full-HD projector + 8 ft screen',
   '3500-lumen projector with tripod screen, HDMI and extension cables.',
   1200, 'Event & Sound', 'Projectors & Screens', '', 'photo-1478720568477-152d9b164e26', 'rent', 'day', 3000, 1, 7, NULL,
   ARRAY['Screen included', 'HDMI cable'], '{"brightness":"3500 lumens"}', 81, 10, -0.0001, -0.0004),
  ('e0000000-0000-4000-8000-000000000015', 'd0000000-0000-4000-8000-000000000003', 'PS5 with 2 controllers',
   'PlayStation 5 disc edition with FIFA and two DualSense controllers.',
   700, 'Electronics', 'Gaming', '', 'photo-1606144042614-b2417e99c4e3', 'rent', 'day', 5000, 1, 7, NULL,
   ARRAY['Pickup only'], '{}', 188, 1, 0.0003, 0.0005),
  ('e0000000-0000-4000-8000-000000000016', 'd0000000-0000-4000-8000-000000000003', 'MacBook Air M1 (8 GB / 256 GB)',
   'Battery health 89%, original charger, no dents.',
   48000, 'Electronics', 'Laptops & Computers', 'Good', 'photo-1517336714731-489689fd1ca8', 'sale', 'day', 0, 1, NULL, NULL,
   ARRAY[]::text[], '{}', 143, 6, -0.0006, -0.0003),

  -- Pedal & Ride (Palarivattom)
  ('e0000000-0000-4000-8000-000000000017', 'd0000000-0000-4000-8000-000000000004', 'Road bike — Triban RC120',
   'Aluminium road bike, 16 speeds, helmet included.',
   300, 'Vehicles', 'Bicycles', '', 'photo-1485965120184-e220f721d03e', 'rent', 'day', 2000, 1, 30, NULL,
   ARRAY['Pickup only'], '{}', 72, 14, 0.0002, 0.0001),
  ('e0000000-0000-4000-8000-000000000018', 'd0000000-0000-4000-8000-000000000004', 'City cycle with basket',
   'Comfortable single-speed cycle for daily commutes.',
   120, 'Vehicles', 'Bicycles', '', 'photo-1532298229144-0ec0c57515c7', 'rent', 'day', 1000, 1, 30, NULL,
   ARRAY['Pickup only'], '{}', 39, 20, -0.0003, 0.0002),
  ('e0000000-0000-4000-8000-000000000019', 'd0000000-0000-4000-8000-000000000004', 'Royal Enfield Classic 350',
   'Well-maintained 2022 Classic with two helmets. Licence check at pickup.',
   1200, 'Vehicles', 'Bikes & Scooters', '', 'photo-1558981806-ec527fa84c39', 'rent', 'day', 5000, 1, 10, NULL,
   ARRAY['Pickup only'], '{"engine":"350 cc"}', 156, 5, 0.0004, -0.0004),
  ('e0000000-0000-4000-8000-000000000020', 'd0000000-0000-4000-8000-000000000004', 'Yamaha R15 V3 (2021)',
   'Single owner, 14,000 km, serviced every 3,000 km.',
   135000, 'Vehicles', 'Bikes & Scooters', 'Good', 'photo-1568772585407-9361f9bf3a87', 'sale', 'day', 0, 1, NULL, NULL,
   ARRAY[]::text[], '{}', 201, 9, -0.0002, 0.0005),
  ('e0000000-0000-4000-8000-000000000021', 'd0000000-0000-4000-8000-000000000004', 'Bosch cordless drill kit',
   '18 V drill with two batteries and a 30-piece bit set.',
   200, 'Tools & DIY', 'Power Tools', '', 'photo-1504148455328-c376907d081c', 'rent', 'day', 1500, 1, 7, NULL,
   ARRAY['Pickup only'], '{}', 44, 12, 0.0005, 0.0003),

  -- Campus Corner Books (CUSAT, Kalamassery)
  ('e0000000-0000-4000-8000-000000000022', 'd0000000-0000-4000-8000-000000000005', 'B.Tech CSE semester 5 textbook set',
   'All six KTU semester-5 textbooks, lightly highlighted.',
   1200, 'Books', 'Textbooks', 'Good', 'photo-1497633762265-9d179a990aa6', 'sale', 'day', 0, 1, NULL, NULL,
   ARRAY[]::text[], '{}', 117, 2, 0.0001, 0.0002),
  ('e0000000-0000-4000-8000-000000000023', 'd0000000-0000-4000-8000-000000000005', 'Bestseller novel bundle (10 books)',
   'Ten popular paperbacks in good condition.',
   900, 'Books', 'Novels', 'Good', 'photo-1524995997946-a1c2e315a42f', 'sale', 'day', 0, 1, NULL, NULL,
   ARRAY[]::text[], '{}', 48, 15, -0.0004, -0.0001),
  ('e0000000-0000-4000-8000-000000000024', 'd0000000-0000-4000-8000-000000000005', 'Dell Inspiron 15 (i5, 8 GB, SSD)',
   'Student laptop, new battery, Windows 11.',
   26000, 'Electronics', 'Laptops & Computers', 'Good', 'photo-1496181133206-80ce9b88a853', 'sale', 'day', 0, 1, NULL, NULL,
   ARRAY[]::text[], '{}', 132, 4, 0.0003, -0.0003),
  ('e0000000-0000-4000-8000-000000000025', 'd0000000-0000-4000-8000-000000000005', 'iPhone 12 (128 GB)',
   'Battery health 86%, always used with a case. Box and bill available.',
   32000, 'Electronics', 'Mobiles & Tablets', 'Like new', 'photo-1511707171634-5f897ff02aa9', 'sale', 'day', 0, 1, NULL, NULL,
   ARRAY[]::text[], '{}', 176, 1, -0.0002, 0.0004),

  -- Kochi Event Decor & Tents (Vyttila)
  ('e0000000-0000-4000-8000-000000000026', 'd0000000-0000-4000-8000-000000000006', 'Banquet chairs with covers — set of 100',
   'Cushioned banquet chairs with white covers and sashes, delivered and arranged.',
   2000, 'Event & Sound', 'Chairs & Tables', '', 'photo-1530023367847-a683933f4172', 'rent', 'day', 2000, 1, 5, NULL,
   ARRAY['Chair covers', 'Delivery available'], '{"quantity":"100 chairs"}', 109, 3, 0.0002, -0.0002),
  ('e0000000-0000-4000-8000-000000000027', 'd0000000-0000-4000-8000-000000000006', 'Wedding table setup — 10 round tables',
   'Ten 6-ft round tables with linen, runners and centrepieces for 80–100 guests.',
   3500, 'Event & Sound', 'Chairs & Tables', '', 'photo-1519225421980-715cb0215aed', 'rent', 'day', 3000, 1, 3, NULL,
   ARRAY['Round tables', 'Setup included'], '{"quantity":"10 tables"}', 84, 8, -0.0003, 0.0003),
  ('e0000000-0000-4000-8000-000000000028', 'd0000000-0000-4000-8000-000000000006', 'Floral centrepieces & table decor',
   'Fresh-flower centrepieces, candles and runners styled to your colour theme.',
   2800, 'Event & Sound', 'Stage & Decor', '', 'photo-1511795409834-ef04bbd61622', 'rent', 'day', 0, 1, 2, NULL,
   ARRAY['Flower decor', 'Setup included'], '{}', 66, 10, 0.0004, 0.0004),
  ('e0000000-0000-4000-8000-000000000029', 'd0000000-0000-4000-8000-000000000006', 'Ford Mustang wedding car',
   'Decorated Mustang with chauffeur for the bride and groom. Up to 4 hours within Kochi.',
   12000, 'Vehicles', 'Cars', '', 'photo-1494976388531-d1058494cdd8', 'rent', 'day', 5000, 1, 1, NULL,
   ARRAY['Operator included', 'Flower decor'], '{"seats":"4 seater"}', 190, 6, -0.0005, -0.0001),
  ('e0000000-0000-4000-8000-000000000030', 'd0000000-0000-4000-8000-000000000006', '4-person camping tent',
   'Waterproof dome tent with groundsheet and two sleeping mats.',
   350, 'Sports & Outdoor', 'Camping & Trekking', '', 'photo-1504280390367-361c6d9f38f4', 'rent', 'day', 1500, 1, 10, NULL,
   ARRAY['Waterproof'], '{}', 61, 17, 0.0001, 0.0006),

  -- Urban Threads (MG Road)
  ('e0000000-0000-4000-8000-000000000031', 'd0000000-0000-4000-8000-000000000007', 'Kanjivaram silk saree',
   'Rich maroon-and-gold silk saree with stitched blouse (free alteration).',
   1500, 'Fashion', 'Ethnic & Occasion', '', 'photo-1610030469983-98e550d6193c', 'rent', 'day', 3000, 1, 3, NULL,
   ARRAY['Pickup only'], '{}', 99, 5, 0.0002, 0.0002),
  ('e0000000-0000-4000-8000-000000000032', 'd0000000-0000-4000-8000-000000000007', 'Designer ethnic gown',
   'Hand-embroidered ivory gown, sizes S–L.',
   2200, 'Fashion', 'Ethnic & Occasion', '', 'photo-1583391733956-3750e0ff4e8b', 'rent', 'day', 4000, 1, 3, NULL,
   ARRAY['Pickup only'], '{}', 73, 9, -0.0003, -0.0002),
  ('e0000000-0000-4000-8000-000000000033', 'd0000000-0000-4000-8000-000000000007', 'Party-wear clearance — 20 pieces',
   'Twenty tops and dresses from last season, sizes M and L.',
   6000, 'Fashion', 'Women', 'Like new', 'photo-1490481651871-ab68de25d43d', 'sale', 'day', 0, 1, NULL, NULL,
   ARRAY[]::text[], '{}', 42, 13, 0.0004, -0.0004),

  -- HomeNest Furniture (Kaloor)
  ('e0000000-0000-4000-8000-000000000034', 'd0000000-0000-4000-8000-000000000008', '3-seater fabric sofa',
   'Bottle-green velvet sofa, 18 months old, from a smoke-free home.',
   14500, 'Furniture', 'Sofas & Chairs', 'Like new', 'photo-1555041469-a586c61ea9bc', 'sale', 'day', 0, 1, NULL, NULL,
   ARRAY[]::text[], '{}', 128, 7, 0.0003, 0.0001),
  ('e0000000-0000-4000-8000-000000000035', 'd0000000-0000-4000-8000-000000000008', 'Accent lounge chair',
   'Mid-century style lounge chair with oak legs.',
   4800, 'Furniture', 'Sofas & Chairs', 'Good', 'photo-1524758631624-e2822e304c36', 'sale', 'day', 0, 1, NULL, NULL,
   ARRAY[]::text[], '{}', 51, 18, -0.0002, 0.0003),
  ('e0000000-0000-4000-8000-000000000036', 'd0000000-0000-4000-8000-000000000008', 'Queen bed with mattress — monthly',
   'Queen bed with a 6-inch mattress, delivered and assembled. Minimum 3 months.',
   1800, 'Furniture', 'Beds & Mattresses', '', 'photo-1505693416388-ac5ce068fe85', 'rent', 'month', 3000, 3, 24, NULL,
   ARRAY['Delivery available', 'Setup included'], '{}', 87, 11, 0.0005, -0.0003),
  ('e0000000-0000-4000-8000-000000000037', 'd0000000-0000-4000-8000-000000000008', 'Mini fridge (90 L) — monthly',
   'Energy-efficient mini fridge, ideal for hostels and PGs.',
   900, 'Electronics', 'Appliances', '', 'photo-1571175443880-49e1d25b2bc5', 'rent', 'month', 2000, 1, 12, NULL,
   ARRAY['Delivery available'], '{}', 69, 14, -0.0004, -0.0005),
  ('e0000000-0000-4000-8000-000000000038', 'd0000000-0000-4000-8000-000000000008', 'Samsung 43" 4K smart TV',
   'Two years old with wall mount and remote.',
   18000, 'Electronics', 'TV & Audio', 'Good', 'photo-1593359677879-a4bb92f829d1', 'sale', 'day', 0, 1, NULL, NULL,
   ARRAY[]::text[], '{}', 95, 8, 0.0001, 0.0005),
  ('e0000000-0000-4000-8000-000000000039', 'd0000000-0000-4000-8000-000000000008', 'Gym bench + 40 kg dumbbell set',
   'Adjustable bench and chrome dumbbells, barely used.',
   7500, 'Sports & Outdoor', 'Fitness', 'Like new', 'photo-1534438327276-14e5300c3a48', 'sale', 'day', 0, 1, NULL, NULL,
   ARRAY[]::text[], '{}', 58, 20, -0.0005, 0.0002),
  ('e0000000-0000-4000-8000-000000000040', 'd0000000-0000-4000-8000-000000000008', 'Furnished room near Kaloor metro',
   'Single room in a shared flat: bed, wardrobe, Wi-Fi and housekeeping. Walk to the metro.',
   8500, 'Properties', 'Rooms & PG', '', 'photo-1522708323590-d24dbb6b0267', 'rent', 'month', 15000, 3, 12, NULL,
   ARRAY['Pickup only'], '{}', 140, 4, 0.0007, 0.0002)
) AS l(id, seller, title, description, price, category, subcategory, condition, photo, kind, unit, deposit,
       min_units, max_units, capacity, features, attributes, views, age_days, dlat, dlng)
JOIN (
  SELECT id, (store_location->>'lat')::numeric AS lat, (store_location->>'lng')::numeric AS lng,
         store_location->>'address' AS address
  FROM public.profiles
) p ON p.id = l.seller::uuid
ON CONFLICT (id) DO NOTHING;

-- 4. A few reviews so ratings aren't all "New" (the rating trigger averages them)
INSERT INTO public.reviews (id, seller_id, buyer_id, product_id, rating, comment, created_at)
SELECT r.id::uuid, r.seller::uuid, r.buyer::uuid, r.product::uuid, r.rating, r.comment, NOW() - make_interval(days => r.age_days)
FROM (VALUES
  ('f0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-0000000000b1', 'e0000000-0000-4000-8000-000000000001', 5.0, 'Crystal-clear sound for our college fest, and they set everything up on time.', 4),
  ('f0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-0000000000b2', 'e0000000-0000-4000-8000-000000000004', 4.5, 'Lights looked amazing. Technician stayed till the end.', 9),
  ('f0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-0000000000b1', 'e0000000-0000-4000-8000-000000000008', 4.5, 'Spacious hall, clean kitchen, plenty of parking.', 12),
  ('f0000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-0000000000b2', 'e0000000-0000-4000-8000-000000000011', 5.0, 'Camera was spotless and the batteries were fully charged.', 6),
  ('f0000000-0000-4000-8000-000000000005', 'd0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-0000000000b1', 'e0000000-0000-4000-8000-000000000015', 4.0, 'Smooth pickup with the QR code. Would rent again.', 3),
  ('f0000000-0000-4000-8000-000000000006', 'd0000000-0000-4000-8000-000000000006', 'd0000000-0000-4000-8000-0000000000b2', 'e0000000-0000-4000-8000-000000000026', 5.0, 'Chairs arrived early and the covers were spotless.', 7),
  ('f0000000-0000-4000-8000-000000000007', 'd0000000-0000-4000-8000-000000000008', 'd0000000-0000-4000-8000-0000000000b1', 'e0000000-0000-4000-8000-000000000036', 4.5, 'Bed was delivered and assembled the same day.', 10),
  ('f0000000-0000-4000-8000-000000000008', 'd0000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-0000000000b2', 'e0000000-0000-4000-8000-000000000019', 4.0, 'Bike was in great shape. Helmets were a bit worn.', 15)
) AS r(id, seller, buyer, product, rating, comment, age_days)
ON CONFLICT (id) DO NOTHING;

COMMIT;
