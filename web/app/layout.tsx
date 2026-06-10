import type { Metadata } from "next";
import { Archivo, Sora, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const display = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-display",
  display: "swap",
});

const body = Sora({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FIFA World Cup 2026 · Prediction Engine",
  description:
    "A probabilistic forecast of all 104 matches — time-decayed Elo, Dixon-Coles bivariate Poisson, and a bookmaker blend over thousands of Monte Carlo tournaments.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="grain">
        <div className="field-backdrop" aria-hidden />
        <div className="field-lines" aria-hidden />
        <div className="relative z-[2]">{children}</div>
      </body>
    </html>
  );
}
