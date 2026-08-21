import type { Metadata, Viewport } from "next";
import { Archivo, Bebas_Neue, Courier_Prime } from "next/font/google";
import { AppFrame } from "@/components/shell/app-frame";
import { SessionProvider } from "@/components/providers/session-provider";
import { ToastProvider } from "@/components/providers/toast-provider";
import { ServiceWorkerBridge } from "@/components/pwa/service-worker-bridge";
import "./globals.css";

/**
 * Three faces, borrowed from the packaging this app is about.
 *
 *  - **Bebas Neue** for mastheads and titles: the condensed all-caps of a film
 *    carton, a cinema one-sheet, a darkroom door sign. It carries the period
 *    without costing legibility at small sizes.
 *  - **Archivo** for interface text — a grotesque with actual character, where
 *    a neutral UI sans would drag the whole thing back to the present day.
 *  - **Courier Prime** for machine facts: counts, timestamps, frame numbers,
 *    spec lines. Typewriter, because that is what a photo lab labelled things
 *    with.
 *
 * Nothing else gets added without removing one of these.
 */
const display = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display-face",
  display: "swap",
});

const sans = Archivo({
  subsets: ["latin"],
  variable: "--font-sans-face",
  display: "swap",
});

const mono = Courier_Prime({
  weight: ["400", "700"],
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
