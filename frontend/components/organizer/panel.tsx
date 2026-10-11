"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Icon } from "@/components/icons";
import { useLeague } from "@/components/league-context";
import { Band, LoginRequired, Notice, Page } from "@/components/ui";
import { section, type SectionId } from "@/lib/sections";
import { useSession } from "@/lib/session";

/**
 * Marco de cada sección del panel, como en el diseño (band + page): exige sesión de
 * organizador (sin sesión lleva a /entrar) y muestra la banda azul de la sección.
 * El contenido se dibuja solo con la sesión lista; la liga activa sale de useLeague.
 * Si la sección trabaja sobre una liga y el organizador todavía no tiene ninguna,
 * muestra "Aún no tienes ligas creadas" con el botón para crear la primera.
 */
export function PanelSection({
  id,
  intro,
  title,
  requireLeague = true,
  children,
}: {
  id: Exclude<SectionId, "publico">;
  intro: React.ReactNode;
  title?: React.ReactNode;
  requireLeague?: boolean;
  children: React.ReactNode;
}) {
  const { user, ready } = useSession();
  const router = useRouter();
  const { leagues, league, error } = useLeague();

  useEffect(() => {
    if (ready && !user) router.replace("/entrar");
  }, [ready, user, router]);

  if (!ready || !user) return null;
  if (user.role !== "organizador") return <LoginRequired role="organizadores" />;

  return (
    <>
      <Band icon={id} title={title ?? section(id).label} intro={intro} />
      <Page>
        {error && <Notice tone="error">{error}</Notice>}
        {requireLeague && leagues && !league ? <NoLeagues /> : children}
      </Page>
    </>
  );
}

/** Estado vacío de Mis ligas: todavía no hay ninguna liga a nombre del organizador. */
export function NoLeagues() {
  return (
    <section className="card empty-state">
      <span className="empty-icon" aria-hidden>
        <Icon id="ligas" />
      </span>
      <h2>Aún no tienes ligas creadas</h2>
      <p>Crea tu primera liga con su nombre y su deporte. Después te guiamos paso a paso: temporada, categorías, reglamento, equipos y calendario.</p>
      <Link className="btn btn-blue" href="/ligas/nueva">
        Crear mi primera liga
      </Link>
    </section>
  );
}
