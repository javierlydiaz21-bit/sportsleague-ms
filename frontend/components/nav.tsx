"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { logout, useSession } from "@/lib/session";

const ROLE_LABEL = { organizador: "Organizador", arbitro: "Árbitro", espectador: "Espectador" };

function Bell() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" strokeLinejoin="round" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" strokeLinecap="round" />
    </svg>
  );
}

export default function Nav() {
  const { user, ready } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  const links = [
    { href: "/", label: "Partidos", match: (p: string) => p === "/" || p.startsWith("/partidos") || p.startsWith("/temporadas") },
    ...(user?.role === "arbitro" ? [{ href: "/arbitro", label: "Mis partidos", match: (p: string) => p.startsWith("/arbitro") }] : []),
    ...(user?.role === "organizador"
      ? [
          { href: "/organizador", label: "Organizador", match: (p: string) => p.startsWith("/organizador") },
          { href: "/analitica", label: "Analítica", match: (p: string) => p.startsWith("/analitica") },
        ]
      : []),
  ];

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface-2/95 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center gap-4 px-4 sm:px-8" aria-label="Principal">
        <Link href="/" className="flex shrink-0 items-center gap-2 py-3 font-display text-2xl font-bold tracking-wide">
          <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6 text-sync" fill="currentColor">
            <circle cx="12" cy="12" r="10" opacity=".25" />
            <path d="M12 5.5l3.8 2.7-1.4 4.4H9.6L8.2 8.2z" />
          </svg>
          <span>
            Sports<span className="text-sync">League</span>
          </span>
        </Link>
        <ul className="scroll-x flex flex-1 gap-5 text-sm">
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} aria-current={l.match(pathname) ? "page" : undefined} className="tab inline-block py-4">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="flex shrink-0 items-center gap-2 text-sm">
          {ready && user && (
            <>
              <Link
                href="/notificaciones"
                aria-label="Notificaciones"
                aria-current={pathname.startsWith("/notificaciones") ? "page" : undefined}
                className="rounded-full p-2 text-muted hover:bg-surface hover:text-ink aria-[current=page]:text-sync"
              >
                <Bell />
              </Link>
              <span className="hidden text-right leading-tight sm:block">
                <span className="block text-sm">{user.name}</span>
                <span className="block text-xs text-muted">{ROLE_LABEL[user.role]}</span>
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
