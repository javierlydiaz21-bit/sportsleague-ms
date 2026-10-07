"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/session";

export default function Footer() {
  const pathname = usePathname();
  const { user } = useSession();
  if (pathname === "/login" || pathname === "/registro") return null;
  return (
    <footer className="foot">
      <div className="wrap">
        <span>SportsLeague: ligas deportivas amateur de fútbol, básquet y vóley.</span>
        <nav aria-label="Pie de página">
          <Link href="/">Partidos</Link>
          {user?.role === "organizador" && <Link href="/organizador">Panel de organizadores</Link>}
          {!user && <Link href="/registro">Crear cuenta</Link>}
          {!user && <Link href="/login">Iniciar sesión</Link>}
        </nav>
      </div>
    </footer>
  );
}
