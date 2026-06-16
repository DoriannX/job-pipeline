import type { Metadata } from "next";
import { Fraunces, Quicksand } from "next/font/google";
import "./globals.css";
import { PlumeSprite } from "@/design/illustration/PlumeSprite";

// Display = Fraunces (titres, noms, chiffres) ; corps = Quicksand. Jamais Inter / système.
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["600"],
  style: ["normal", "italic"],
  display: "swap",
});

const quicksand = Quicksand({
  subsets: ["latin"],
  variable: "--font-quicksand",
  weight: ["500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Plume",
  description: "Carnet vivant illustré pour entretenir son réseau, dans sa propre voix.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${fraunces.variable} ${quicksand.variable}`}>
      <body>
        {/* Sprite de l'illustration maison monté UNE fois, au-dessus de tout. */}
        <PlumeSprite />
        {children}
      </body>
    </html>
  );
}
