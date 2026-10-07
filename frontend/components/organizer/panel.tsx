"use client";

import { Band, LoginRequired, Notice, Page } from "@/components/ui";
import { section, type SectionId } from "@/lib/sections";
import { useSession } from "@/lib/session";
import { useApi } from "@/lib/use-api";
import type { League } from "@/lib/types";

/**
 * Marco de cada sección del panel: exige sesión de organizador, muestra la banda de
 * la sección y entrega las ligas (League Service) a su contenido.
 */
export default function OrganizerSection({
  id,
  children,
}: {
  id: Exclude<SectionId, "publico">;
  children: (ctx: { leagues: League[]; reload: () => void }) => React.ReactNode;
}) {
  const { user, ready } = useSession();
  const isOrganizer = user?.role === "organizador";
  const leagues = useApi<League[]>(isOrganizer ? "/leagues" : null);
  const s = section(id);

  if (!ready) return null;
  if (!isOrganizer) return <LoginRequired role="organizadores" />;

  return (
    <>
      <Band icon={id} title={s.label} intro={s.intro} />
      <Page>
        {leagues.error && <Notice tone="error">{leagues.error}</Notice>}
        {leagues.loading && <p className="empty">Cargando...</p>}
        {leagues.data && children({ leagues: leagues.data, reload: leagues.reload })}
      </Page>
    </>
  );
}
