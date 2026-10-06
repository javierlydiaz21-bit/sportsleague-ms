import type { Metadata } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import KeepAwake from "@/components/keep-awake";
import Nav from "@/components/nav";
import "./globals.css";

const barlow = Barlow({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-barlow" });
const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-barlow-condensed",
});

export const metadata: Metadata = {
  title: { default: "SportsLeague", template: "%s | SportsLeague" },
  description:
    "Calendario, marcador en vivo, tabla de posiciones y panel de organizadores de SportsLeague, ligas deportivas amateur.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`h-full antialiased ${barlow.variable} ${barlowCondensed.variable}`}>
      <body className="min-h-full font-sans">
        <Nav />
        <KeepAwake />
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8">{children}</div>
      </body>
    </html>
  );
}
