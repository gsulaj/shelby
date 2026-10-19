import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Barlow_Condensed, Inter } from "next/font/google";
import Script from "next/script";
import "lenis/dist/lenis.css";
import "./globals.css";
import { SmoothScroll } from "@/components/layout/SmoothScroll";
import { site } from "@/content/site";

const barlowCondensed = Barlow_Condensed({
  weight: ["600", "700"],
  subsets: ["latin"],
  variable: "--font-barlow-condensed",
  display: "swap",
});

// Inter is a variable font: Turbopack rejects a weight list, and the variable axis covers 400–600.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: `${site.name} — Expert Exterior Remodeling in Macomb County`,
  description: site.story.long,
  // Pitch prototype: keep it out of search engines (public/robots.txt disallows all crawlers too).
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${barlowCondensed.variable} ${inter.variable}`}>
      <body className="min-h-full bg-ink font-body text-on-dark antialiased">
        <SmoothScroll />
        {children}
        {/* Chatling chat widget: the config must exist before embed.js runs, so it renders first. */}
        <Script id="chtl-config" strategy="afterInteractive">
          {`window.chtlConfig = { chatbotId: "2823318974" }`}
        </Script>
        <Script
          async
          data-id="2823318974"
          id="chtl-script"
          type="text/javascript"
          src="https://chatling.ai/js/embed.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
