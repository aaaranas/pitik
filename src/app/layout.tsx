import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Inter, JetBrains_Mono } from "next/font/google";
import { AppFrame } from "@/components/shell/app-frame";
import { SessionProvider } from "@/components/providers/session-provider";
import { ToastProvider } from "@/components/providers/toast-provider";
import { ServiceWorkerBridge } from "@/components/pwa/service-worker-bridge";
import "./globals.css";

/**
 * Three faces, each with a job:
 *  - a serif for anything the user wrote or named, so their words look printed
 *  - a grotesque for interface text
 *  - a monospace for machine facts: counts, timestamps, frame numbers
 * Nothing else gets added without removing one of these.
 */
const display = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
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
