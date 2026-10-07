"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useLeague } from "@/components/league-context";
import { Band, LoginRequired, Notice, Page } from "@/components/ui";
import { section, type SectionId } from "@/lib/sections";
import { useSession } from "@/lib/session";

/**
 * Marco de cada sección del panel, como en el diseño (band + page): exige sesión de
 * organizador (sin sesión lleva a /entrar) y muestra la banda azul de la sección.
 * El contenido se dibuja solo con la sesión lista; la liga activa sale de useLeague.
 */
export function PanelSection({
  id,
  intro,
  children,
}: {
  id: Exclude<SectionId, "publico">;
  intro: React.ReactNode;
  children: React.ReactNode;
}) {
  const { user, ready } = useSession();
  const router = useRouter();
  const { error } = useLeague();

  useEffect(() => {
    if (ready && !user) router.replace("/entrar");
  }, [ready, user, router]);

  if (!ready || !user) return null;
  if (user.role !== "organizador") return <LoginRequired role="organizadores" />;

  return (
    <>
      <Band icon={id} title={section(id).label} intro={intro} />
      <Page>
        {error && <Notice tone="error">{error}</Notice>}
        {children}
      </Page>
    </>
  );
}

