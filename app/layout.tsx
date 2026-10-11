import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FloodLens",
  description: "Community flood intelligence — real-time hazard map powered by citizens",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FloodLens",
    startupImage: [
      {
        url: "/icons/apple-touch-icon.png",
      },
    ],
  },
  icons: {
    icon: [
      { url: "/icons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/icons/favicon-32x32.png",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "msapplication-TileImage": "/icons/icon-144x144.png",
    "msapplication-TileColor": "#0f172a",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
    { media: "(prefers-color-scheme: light)", color: "#0f172a" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,        // Prevents unwanted pinch-zoom on map
  userScalable: false,
  viewportFit: "cover",   // Critical for iPhone notch / Dynamic Island
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/* 100dvh fills the exact visible viewport on both iOS Safari and Android Chrome */}
      <body className="w-full h-[100dvh] overflow-hidden bg-slate-900 font-sans relative">
        {children}
      </body>
    </html>
  );
}