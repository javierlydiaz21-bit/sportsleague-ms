"use client";

import DemoData from "@/components/organizer/demo-data";
import Fixture from "@/components/organizer/fixture";
import Leagues from "@/components/organizer/leagues";
import Referees from "@/components/organizer/referees";
import Teams from "@/components/organizer/teams";
import { LoginRequired, Notice } from "@/components/ui";
import { useSession } from "@/lib/session";
import { useApi } from "@/lib/use-api";
import type { League } from "@/lib/types";

const SECTIONS = [
  ["#demo", "Datos de ejemplo"],
  ["#ligas", "Ligas"],
  ["#equipos", "Equipos"],
  ["#arbitros", "Árbitros"],
  ["#calendario", "Calendario"],
];

export default function OrganizerPage() {
  const { user, ready } = useSession();
  const isOrganizer = user?.role === "organizador";
  const leagues = useApi<League[]>(isOrganizer ? "/leagues" : null);

  if (!ready) return null;
  if (!isOrganizer) return <LoginRequired role="organizadores" />;

  return (
    <main className="space-y-6">
      <header>
        <h1 className="font-display text-4xl font-bold">Panel de organizadores</h1>
        <p className="mt-1 text-muted">Cada formulario llama a un microservicio a través del API Gateway, con tu sesión.</p>
        <nav aria-label="Secciones" className="mt-3 flex flex-wrap gap-2 text-sm">
          {SECTIONS.map(([href, label]) => (
            <a key={href} href={href} className="rounded-md border border-line px-3 py-1 hover:border-sync">
              {label}
            </a>
          ))}
        </nav>
      </header>
      {leagues.error && <Notice tone="error">{leagues.error}</Notice>}
      <DemoData onDone={leagues.reload} />
      {leagues.data && (
        <>
          <Leagues leagues={leagues.data} onChange={leagues.reload} />
          <Teams leagues={leagues.data} />
          <Referees leagues={leagues.data} />
          <Fixture leagues={leagues.data} onChange={leagues.reload} />
        </>
      )}
    </main>
  );
}
