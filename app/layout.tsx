import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Bridge — A calmer way through the same fight",
    template: "%s · Bridge",
  },
  description:
    "A private, consent-first space for couples to work through conflict. Each of you talks privately, approves what to share, then reads the other’s view.",
  applicationName: "Bridge",
  openGraph: {
    title: "Bridge — A calmer way through the same fight",
    description:
      "A private space for each of you. A shared view you both approve. A way to close the loop without another argument.",
    siteName: "Bridge",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#faf7f1",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${fraunces.variable} h-full scroll-smooth antialiased motion-reduce:scroll-auto`}
    >
      <body className="flex min-h-full flex-col bg-bone font-sans text-ink">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-ink focus:px-5 focus:py-3 focus:text-sm focus:font-medium focus:text-bone"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
