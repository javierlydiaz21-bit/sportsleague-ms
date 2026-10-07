import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import Footer from "@/components/footer";
import KeepAwake from "@/components/keep-awake";
import { LeagueProvider } from "@/components/league-context";
import Nav from "@/components/nav";
import "./globals.css";

// Archivo con su eje de ancho: los títulos y las cifras usan la versión condensada
const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo" });

export const metadata: Metadata = {
  title: { default: "SportsLeague", template: "%s · SportsLeague" },
  description:
    "Calendario, marcador en vivo, tabla de posiciones y panel de organizadores de SportsLeague, ligas deportivas amateur.",
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#0E1630",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={archivo.variable}>
      <body>
        <LeagueProvider>
          <Nav />
          <KeepAwake />
          {children}
          <Footer />
        </LeagueProvider>
      </body>
    </html>
  );
}
