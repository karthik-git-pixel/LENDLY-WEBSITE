<div align="center">
  
<img src="public/logo.svg" width="72" alt="Lendly logo" />

# Lendly

**Find what you need, right around you.**

*A hyperlocal marketplace for students & local communities*

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)

Lendly is a sleek, hyper-local marketplace designed specifically for students and local shop owners. It enables users to **buy, sell, and rent items** within a strict 2-5km radius, fostering a community-driven economy built on trust, proximity, and instant transactions.

</div>

---

## ✨ Features

- **📍 Hyper-Local Discovery**: Uses precise geolocation to show you items and services available right in your immediate vicinity.
- **🛒 Buy, Sell & Rent**: A flexible marketplace. Buy items outright, list your own goods, or rent out equipment for temporary use.
- **🏪 Premium Seller Dashboard**: Dedicated tools for local sellers to manage inventory, track live orders, and monitor their wallet balance.
- **💬 Real-Time Chat**: Integrated Firebase-powered messaging system allowing buyers and sellers to negotiate and communicate instantly.
- **💳 Digital Wallet**: A built-in virtual wallet for tracking earnings, processing refunds, and managing platform credit.
- **📷 QR Code Verification**: Ensuring secure order handoffs. Buyers scan the seller's QR code upon pickup to finalize the transaction securely.
- **🗺️ Interactive Map View**: Visualize exactly where products are located around you using an interactive Leaflet map interface.
- **🎨 Premium UI/UX**: Lendly's orange & navy brand system — Figtree display type, a floating mobile nav, image-forward listing cards and a live "near you" hero.

## 🛠️ Technology Stack

| Category | Technology |
| :--- | :--- |
| **Frontend Framework** | [Next.js 16 (App Router)](https://nextjs.org/) |
| **Language** | [TypeScript](https://www.typescriptlang.org/) |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) & Native CSS Variables |
| **Authentication** | [Firebase Auth](https://firebase.google.com/) (Google OAuth & Email/Password) |
| **Database** | [Firestore](https://firebase.google.com/docs/firestore) & [Realtime Database](https://firebase.google.com/docs/database) |
| **Storage & CDN** | [Cloudinary](https://cloudinary.com/) |
| **Maps & Routing** | [Leaflet](https://leafletjs.com/) & React-Leaflet |
| **Icons** | [Lucide React](https://lucide.dev/) |

## 🚀 Getting Started

Follow these instructions to set up the project locally on your machine.

### Prerequisites

Ensure you have the following installed and set up:
- Node.js (v18 or later)
- npm, yarn, or pnpm
- A Firebase Project (with Firestore Database, Realtime Database, and Authentication enabled)
- A Cloudinary Account

### 1. Clone the repository

```bash
git clone https://github.com/anandhukrishnaas1/RadiusCart.git
cd RadiusCart/RadiusCart
```

### 2. Install dependencies

```bash
npm install
```

### 3. Environment Setup

Create a `.env.local` file in the root of the project (`RadiusCart/RadiusCart/.env.local`). Add your Firebase and Cloudinary credentials:

```env
# Firebase Client SDK
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://your_project_id-default-rtdb.firebaseio.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id

# Cloudinary
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Optional Cloudflare Worker
NEXT_PUBLIC_CLOUDFLARE_WORKER_URL=your_worker_url
```

> **⚠️ Important Firebase Setup Note:** 
> When creating your Firebase project, ensure you have enabled **Google** and **Email/Password** in the Authentication Sign-In Methods. Additionally, ensure you create a **Firestore Database** and update the security rules to allow read/write access for authenticated users.

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. The app will hot-reload as you make changes.

> The repository and folder are still named `RadiusCart` from before the rebrand; the app itself ships as **Lendly**.

## 📂 Project Architecture

```text
RadiusCart/
├── app/                  # Next.js App Router root
│   ├── (main)/           # Authenticated application layout
│   │   ├── chat/         # Real-time messaging
│   │   ├── explore/      # Map and search discovery
│   │   ├── home/         # Local feed and product listings
│   │   ├── profile/      # User settings & wallet
│   │   └── sell/         # Listing creation interface
│   ├── api/              # Backend API routes (Cloudinary, webhooks)
│   ├── login/            # Authentication & OAuth flows
│   └── onboarding/       # Initial user profile setup
├── components/           # Reusable modular UI components
├── lib/                  # Core utilities & contexts
│   ├── auth-context.tsx  # Global authentication state
│   ├── firestore.ts      # Database schemas and queries
│   └── cloudinary.ts     # Image processing logic
└── public/               # Static assets, icons, and manifest
```

## 🤝 Contributing

We welcome community contributions to Lendly! 
1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
