import type { Metadata, Viewport } from "next";
import { DM_Mono, Fredoka, Plus_Jakarta_Sans } from "next/font/google";
import { AppFrame } from "@/components/shell/app-frame";
import { SessionProvider } from "@/components/providers/session-provider";
import { ToastProvider } from "@/components/providers/toast-provider";
import { ServiceWorkerBridge } from "@/components/pwa/service-worker-bridge";
import "./globals.css";

/**
 * Three faces, one job each.
 *
 *  - **Fredoka** for headings and the wordmark: rounded and warm, but with
 *    enough structure to stay legible at label sizes. Mixed case — the whole
 *    point of it is that it does not shout.
 *  - **Plus Jakarta Sans** for interface text and for everything the user
 *    typed. Its crisp letterforms are what keep a rounded display face from
 *    turning the page to mush.
 *  - **DM Mono** for machine facts: frame numbers, counters, timers,
 *    timestamps. Kept only where digits must align.
 *
 * Nothing else gets added without removing one of these.
 */
const display = Fredoka({
  subsets: ["latin"],
  variable: "--font-display-face",
  display: "swap",
});

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans-face",
  display: "swap",
});

const mono = DM_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-mono-face",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Pitik — Made for moments together",
    template: "%s · Pitik",
  },
  description:
    "A nostalgic digital camera and photobooth for the people you're with. Shoot a roll, print a strip, keep the night.",
  applicationName: "Pitik",
  appleWebApp: {
    capable: true,
    title: "Pitik",
    // Black-translucent lets the viewfinder run under the status bar when
    // installed, which is what makes the standalone app feel native.
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false, date: false, address: false, email: false },
  openGraph: {
    title: "Pitik",
    description: "Made for moments together.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0908",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  // A camera app is a fixed-frame surface; pinch-zooming the chrome only ever
  // happens by accident while reaching for the shutter.
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body className="antialiased">
        <ToastProvider>
          <SessionProvider>
            <AppFrame>{children}</AppFrame>
          </SessionProvider>
        </ToastProvider>
        <ServiceWorkerBridge />
      </body>
    </html>
  );
}
