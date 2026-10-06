"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { logout, useSession } from "@/lib/session";

const ROLE_LABEL = { organizador: "Organizador", arbitro: "Árbitro", espectador: "Espectador" };

export default function Nav() {
  const { user, ready } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  const links = [
    { href: "/", label: "Inicio" },
    ...(user?.role === "organizador"
      ? [
          { href: "/organizador", label: "Organizador" },
          { href: "/analitica", label: "Analítica" },
        ]
      : []),
    ...(user?.role === "arbitro" ? [{ href: "/arbitro", label: "Mis partidos" }] : []),
    ...(user ? [{ href: "/notificaciones", label: "Notificaciones" }] : []),
  ];
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className="border-b border-line bg-surface-2">
      <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-8" aria-label="Principal">
        <Link href="/" className="font-display text-2xl font-bold tracking-wide">
          Sports<span className="text-sync">League</span>
        </Link>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={active(l.href) ? "page" : undefined}
                className={active(l.href) ? "font-semibold text-ink" : "text-muted hover:text-ink"}
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="ml-auto flex items-center gap-3 text-sm">
          {ready && user && (
            <>
              <span className="text-muted">
                {user.name} <span className="rounded bg-surface px-1.5 py-0.5 text-xs">{ROLE_LABEL[user.role]}</span>
              </span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={async () => {
                  await logout();
                  router.push("/");
                }}
              >
                Salir
              </button>
            </>
          )}
          {ready && !user && (
            <Link href="/login" className="btn btn-primary btn-sm">
              Iniciar sesión
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
