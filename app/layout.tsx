import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Figtree } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { LocationProvider } from "@/lib/location-context";
import { LanguageProvider } from "@/lib/language-context";
import { Toaster } from "react-hot-toast";
import InteractionLayer from "@/components/InteractionLayer";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

// Display face for headings and the wordmark — the closest open match to
// the heavy geometric lettering in the Lendly logo
const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  display: "swap",
});

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://lendly.app";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "Lendly — Rent Nearby | Hyperlocal Rental Marketplace",
    template: "%s | Lendly",
  },
  description:
    "Lendly is the hyperlocal rental marketplace for your neighbourhood. Rent cameras, sound systems, event gear, vehicles, and more from verified local neighbours & shops within a 1-30km radius.",
  keywords: [
    "hyperlocal marketplace",
    "buy sell rent nearby",
    "local rental app India",
    "rent camera Kochi",
    "rent textbooks nearby",
    "buy second hand electronics",
    "local classifieds Kochi",
    "peer to peer local deals",
    "Lendly",
    "borrow nearby",
    "lend items to neighbours",
    "hyperlocal shopping",
    "neighborhood trade",
  ],
  authors: [{ name: "Lendly Team", url: baseUrl }],
  creator: "Lendly Hyperlocal Technologies",
  publisher: "Lendly",
  category: "E-Commerce / Hyperlocal Marketplace",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: baseUrl,
    siteName: "Lendly",
    title: "Lendly — Find What You Need, Right Around You",
    description:
      "Filter rentals by walking distance or city radius. Rent from, and connect directly with, verified local shops and neighbours.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Lendly - Hyperlocal Marketplace",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Lendly — Rent Nearby, Spend Wisely",
    description: "Discover verified products & shops right in your neighborhood radius.",
    images: ["/og-image.png"],
    creator: "@lendlyapp",
  },
  icons: {
    icon: [
      { url: "/logo.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48", type: "image/x-icon" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  alternates: {
    canonical: baseUrl,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#ffffff",
};

// Schema.org Structured Data (JSON-LD) for Search Engine Rich Snippets
const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Lendly",
  url: baseUrl,
  logo: `${baseUrl}/logo.png`,
  sameAs: [
    "https://facebook.com/lendlyapp",
    "https://instagram.com/lendlyapp",
    "https://twitter.com/lendlyapp",
  ],
  contactPoint: {
    "@type": "ContactPoint",
    telephone: "+91-95264-77923",
    contactType: "customer service",
    areaServed: "IN",
    availableLanguage: ["English", "Malayalam", "Hindi"],
  },
};

const webSiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Lendly",
  url: baseUrl,
  potentialAction: {
    "@type": "SearchAction",
    target: `${baseUrl}/explore?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteSchema) }}
        />
      </head>
      <body className={`${jakarta.variable} ${figtree.variable}`} suppressHydrationWarning>
        <AuthProvider>
          <LocationProvider>
          <LanguageProvider>
            {children}
            <InteractionLayer />
            <Toaster
              position="top-center"
              gutter={10}
              toastOptions={{
                duration: 3000,
                style: {
                  background: "rgba(255, 255, 255, 0.94)",
                  backdropFilter: "blur(18px) saturate(180%)",
                  WebkitBackdropFilter: "blur(18px) saturate(180%)",
                  color: "var(--foreground)",
                  border: "1px solid rgba(226, 232, 240, 0.9)",
                  boxShadow: "var(--elev-3)",
                  borderRadius: "16px",
                  fontSize: "14px",
                  fontWeight: 600,
                  padding: "12px 16px",
                  maxWidth: "92vw",
                },
                success: { iconTheme: { primary: "#10b981", secondary: "#ffffff" } },
                error: { iconTheme: { primary: "#e53e3e", secondary: "#ffffff" } },
              }}
            />
          </LanguageProvider>
          </LocationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
