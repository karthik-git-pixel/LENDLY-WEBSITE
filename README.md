<div align="center">
  
<img src="public/logo.svg" width="72" alt="Lendly logo" />

# Lendly

**Find what you need, right around you.**

*A hyperlocal marketplace for students & local communities*

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)

Lendly is a sleek, hyper-local marketplace designed for students and local communities. It enables users to **buy, sell, and rent items and services** within their immediate vicinity, fostering a community-driven economy built on proximity, verified trust, and instant transactions.

</div>

---

## ✨ Features

- **📍 Hyper-Local Discovery**: Precise location-based discovery to show items and services available right near you.
- **🛒 Buy, Sell & Rent**: Complete marketplace flexibility — buy items outright, list goods for sale or rent equipment.
- **🏪 Local Shopfronts & Essentials**: Explore top-rated local shops, event equipment, photography gear, audio systems, and local print services.
- **💬 Direct In-App Chat**: Built-in messaging between buyers and sellers to negotiate and coordinate handoffs.
- **💳 Secure Checkout & Razorpay Integration**: Fast order creation and verification for platform orders.
- **📷 QR Code Verification**: Safe and instant handoff verification for order pickup and return.
- **🗺️ Interactive Map View**: Visualize products, shops, and providers on an interactive Leaflet map interface.
- **🎨 Modern Design System**: Responsive mobile-first UI with responsive desktop sidebar, interactive bottom sheets, and rich visual styling.

## 🛠️ Technology Stack

| Category | Technology |
| :--- | :--- |
| **Frontend Framework** | [Next.js 16 (App Router)](https://nextjs.org/) |
| **Language** | [TypeScript](https://www.typescriptlang.org/) |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) & Vanilla CSS Variables |
| **Database & Auth** | [Supabase](https://supabase.com/) (PostgreSQL + Supabase Auth) |
| **Payments** | [Razorpay](https://razorpay.com/) |
| **Storage & Uploads** | [Cloudinary](https://cloudinary.com/) |
| **Maps** | [Leaflet](https://leafletjs.com/) & React-Leaflet |
| **Icons** | [Lucide React](https://lucide.dev/) |

## 🚀 Getting Started

Follow these steps to set up the project locally:

### 1. Clone the repository

```bash
git clone https://github.com/karthik-git-pixel/LENDLY-WEBSITE.git
cd LENDLY-WEBSITE
```

### 2. Install dependencies

```bash
npm install
```

### 3. Environment Setup

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in your credentials in `.env.local`:

```env
# Supabase Credentials (from Supabase Project Settings -> API)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Cloudinary
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# Razorpay
NEXT_PUBLIC_RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret

# Lender identity verification (required in production — encrypts Aadhaar, ID and PAN numbers)
KYC_ENCRYPTION_KEY=a-long-random-secret
# Verification runs in prototype mode (any details accepted) unless this is true
NEXT_PUBLIC_KYC_STRICT=false
# Optional: restrict the admin verification API to these emails
ADMIN_EMAILS=you@example.com

# Optional: map tiles (defaults to OpenStreetMap, no key needed; use a keyed provider for heavy traffic)
NEXT_PUBLIC_MAP_TILE_URL=https://tile.openstreetmap.org/{z}/{x}/{y}.png
NEXT_PUBLIC_MAP_TILE_ATTRIBUTION=&copy; OpenStreetMap contributors
```

### 4. Database Setup

Run the SQL migration in your Supabase SQL Editor:
1. `supabase/schema.sql` (Database schema, tables, and RLS policies)
2. `supabase/seed-demo.sql` (Optional: initial mock data and categories)

Lenders verify their identity (Aadhaar, an ID photo and a selfie) before they can list. To review verifications, make your account an admin and open `/admin/kyc`:

```sql
UPDATE public.profiles SET is_admin = TRUE WHERE email = 'you@example.com';
```

### 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📂 Project Architecture

```text
├── app/                  # Next.js App Router root
│   ├── (main)/           # Main application layouts and pages
│   │   ├── chat/         # Real-time messaging
│   │   ├── explore/      # Map and discovery
│   │   ├── home/         # Local feed and product listings
│   │   ├── plan/         # Event planning assistant
│   │   ├── print/        # Print and Xerox orders
│   │   ├── profile/      # User profile, orders, and saved items
│   │   ├── qr/           # QR code generation and verification
│   │   ├── search/       # Search results page
│   │   ├── sell/         # Lender side: onboarding, ID verification, shop settings, listings
│   │   ├── seller/       # Seller public profile & dashboard
│   │   └── shops/        # Local verified shops
│   ├── admin/            # Admin KYC management
│   ├── api/              # API routes (payment, KYC, upload)
│   ├── auth/             # Supabase auth callbacks & password reset
│   ├── login/            # Authentication login
│   ├── onboarding/       # User profile setup
│   └── register/         # User registration
├── components/           # Reusable UI components
│   ├── market/           # Market feeds, category rail, hero banner, shop cards
│   ├── product/          # Product details, galleries, rent/sale actions
│   └── ui/               # Reusable UI primitives (bottom sheets, modals)
├── lib/                  # Core utilities, Supabase client, and contexts
├── public/               # Static assets, demo data, and logos
└── supabase/             # SQL migrations and demo seed files
```

## 📄 License

Distributed under the MIT License.

