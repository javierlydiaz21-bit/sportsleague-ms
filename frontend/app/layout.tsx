import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "SportsLeague", template: "%s | SportsLeague" },
  description: "Calendario de partidos y panel de organizadores de SportsLeague, ligas deportivas amateur.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full font-sans">
        <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8">{children}</div>
      </body>
    </html>
  );
}
