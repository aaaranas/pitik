import type { Metadata, Viewport } from "next";
import {
  Archivo,
  Caveat,
  Cormorant_Garamond,
  Dancing_Script,
  DM_Mono,
  Plus_Jakarta_Sans,
} from "next/font/google";
import { AppFrame } from "@/components/shell/app-frame";
import { SessionProvider } from "@/components/providers/session-provider";
import { ToastProvider } from "@/components/providers/toast-provider";
import { ServiceWorkerBridge } from "@/components/pwa/service-worker-bridge";
import "./globals.css";

/**
 * Interface faces.
 *
 *  - **Archivo 800** for our words — headings, the wordmark, ink blocks. Set
 *    tight; at display sizes the tracking is what makes it read as a masthead
 *    rather than as a big paragraph.
 *  - **Plus Jakarta Sans** for body copy and everything the user typed.
 *  - **DM Mono** for machine text: counters, timestamps, and the tracked-caps
 *    micro-labels this design runs on.
 *
 * Caption faces below are for the booth strip only. They are never used by the
 * interface, which is exactly why Task 3 has to force them to load before the
 * canvas draws with them.
 */
const display = Archivo({
  weight: ["600", "800"],
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

const captionSerif = Cormorant_Garamond({
  weight: ["600", "700"],
  subsets: ["latin"],
  variable: "--font-serif-face",
  display: "swap",
});

const captionHand = Caveat({
  weight: ["500", "700"],
  subsets: ["latin"],
  variable: "--font-hand-face",
  display: "swap",
});

const captionScript = Dancing_Script({
  weight: ["600", "700"],
  subsets: ["latin"],
  variable: "--font-script-face",
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
    // A light app cannot use black-translucent: it forces white status-bar
    // text, which is invisible on a pastel camera body. The cost is that
    // installed content no longer runs under the status bar.
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false, date: false, address: false, email: false },
  openGraph: {
    title: "Pitik",
    description: "Made for moments together.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#FDFBF7",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  // A camera app is a fixed-frame surface; pinch-zooming the chrome only ever
  // happens by accident while reaching for the shutter.
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${mono.variable} ${captionSerif.variable} ${captionHand.variable} ${captionScript.variable}`}
    >
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
