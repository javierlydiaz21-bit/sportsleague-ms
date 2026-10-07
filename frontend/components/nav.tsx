"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { initials } from "@/components/crest";
import { Icon, Logo, type IconId } from "@/components/icons";
import { useLeague } from "@/components/league-context";
import { SECTIONS } from "@/lib/sections";
import { logout, useSession } from "@/lib/session";
import type { Role } from "@/lib/types";

const ROLE_LABEL = { organizador: "Organizador", arbitro: "Árbitro", espectador: "Espectador" };

interface NavItem {
  href: string;
  label: string;
  icon: IconId;
  match: (p: string) => boolean;
}

const isPublic = (p: string) => p === "/" || p.startsWith("/temporadas") || p.startsWith("/partidos");
const avisos: NavItem = { href: "/notificaciones", label: "Avisos", icon: "avisos", match: (p) => p.startsWith("/notificaciones") };

/** Secciones de la barra según el rol: el organizador ve su panel (como en el diseño), los demás el sitio público. */
function itemsFor(role: Role | undefined): NavItem[] {
  if (role === "organizador") {
    return [
      { href: "/inicio", label: "Inicio", icon: "inicio", match: (p) => p === "/inicio" },
      ...SECTIONS.map((s) => ({ href: s.href, label: s.short, icon: s.id as IconId, match: (p: string) => p.startsWith(s.href) })),
    ];
  }
  const partidos: NavItem = { href: "/", label: "Partidos", icon: "balon", match: isPublic };
  if (role === "arbitro") {
    return [
      partidos,
      { href: "/arbitro", label: "Mis partidos", icon: "arbitros", match: (p) => p.startsWith("/arbitro") },
      avisos,
    ];
  }
  if (role === "espectador") return [partidos, avisos];
  return [partidos];
}

export default function Nav() {
  const { user, ready } = useSession();
  const { leagues, league, setLeague } = useLeague();
  const pathname = usePathname();
  const router = useRouter();
  const menu = useRef<HTMLDetailsElement>(null);

  // El menú de la cuenta se cierra al navegar y al hacer clic fuera
  useEffect(() => {
    menu.current?.removeAttribute("open");
  }, [pathname]);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (menu.current && !menu.current.contains(e.target as Node)) menu.current.removeAttribute("open");
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  if (pathname === "/entrar" || pathname === "/registro") return null;
  const items = itemsFor(ready ? user?.role : undefined);
  const organizer = user?.role === "organizador";

  return (
    <header className="topbar">
      <div className="wrap">
        <Link className="logo" href={organizer ? "/inicio" : "/"}>
          <Logo />
          SportsLeague
        </Link>
        <nav className="squad" aria-label="Secciones">
          {items.map((item) => (
            <Link key={item.href} href={item.href} aria-current={item.match(pathname) ? "page" : undefined}>
              <span className="ico">
                <Icon id={item.icon} />
              </span>
              {item.label}
            </Link>
          ))}
        </nav>
        {ready && user && (
          <details className="menu" ref={menu}>
            <summary aria-label={`Cuenta de ${user.name}`}>{initials(user.name).slice(0, 2)}</summary>
            <div className="menu-panel">
              <p>
                <b>{user.name}</b>
                {organizer ? (league?.name ?? "Sin liga") : `${ROLE_LABEL[user.role]} · ${user.email}`}
              </p>
              {organizer && leagues && leagues.length > 1 && (
                <label className="menu-league">
                  Liga activa
                  <select value={league?.id ?? ""} onChange={(e) => setLeague(Number(e.target.value))}>
                    {[...leagues]
                      .sort((a, b) => b.id - a.id)
                      .map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                          {l.seasons.length ? `, ${l.seasons.map((s) => s.year).join(" y ")}` : ""} (#{l.id})
                        </option>
                      ))}
                  </select>
                </label>
              )}
              {organizer ? <Link href="/publico">Ver sitio público</Link> : <Link href="/notificaciones">Avisos</Link>}
              <button
                type="button"
                onClick={async () => {
                  await logout();
                  router.push(organizer ? "/entrar" : "/");
                }}
              >
                Cerrar sesión
              </button>
            </div>
          </details>
        )}
        {ready && !user && (
          <div className="auth-links">
            <Link href="/registro" className="btn btn-sm">
              Crear cuenta
            </Link>
            <Link href="/entrar" className="btn btn-blue btn-sm">
              Iniciar sesión
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
