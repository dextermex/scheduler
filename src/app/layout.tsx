import type { Metadata } from "next";
import { Barlow_Condensed, Hanken_Grotesk, Fragment_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";

const display = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const sans = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const mono = Fragment_Mono({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-mono",
  display: "swap",
});

// The poster keeps the original serif look, independent of the app UI fonts.
const posterSerif = Playfair_Display({
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["500", "600"],
  variable: "--font-poster",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AURA Scheduler",
  description: "Weekly chatter schedules, Discord shift pings, and rosters.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${mono.variable} ${posterSerif.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
