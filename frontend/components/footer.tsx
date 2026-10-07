"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLeague } from "@/components/league-context";
import { useSession } from "@/lib/session";

export default function Footer() {
  const pathname = usePathname();
  const { user } = useSession();
  const { league } = useLeague();
  if (pathname === "/entrar" || pathname === "/registro") return null;

  // Panel del organizador: el pie del diseño con su liga
  if (user?.role === "organizador") {
    return (
      <footer className="foot">
        <div className="wrap">
          <span>{league ? `${league.name} en SportsLeague` : "SportsLeague"}</span>
          <Link href="/publico">Sitio público de la liga</Link>
        </div>
      </footer>
    );
  }
  return (
    <footer className="foot">
      <div className="wrap">
        <span>SportsLeague: ligas deportivas amateur de fútbol, básquet y vóley.</span>
        <nav aria-label="Pie de página">
          <Link href="/">Partidos</Link>
          {!user && <Link href="/registro">Crear cuenta</Link>}
          {!user && <Link href="/entrar">Iniciar sesión</Link>}
        </nav>
      </div>
    </footer>
  );
}
