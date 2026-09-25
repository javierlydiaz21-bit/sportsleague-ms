import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { getJson, serviceUrl, utcDate, utcDay } from "@/lib/services";

interface Match {
  id: number;
  seasonId: number;
  homeTeam: number;
  awayTeam: number;
  venue: string;
  scheduledAt: string;
  status: string;
}
interface Team {
  id: number;
  name: string;
}

export async function generateMetadata({ params }: PageProps<"/calendario/[seasonId]">): Promise<Metadata> {
  const { seasonId } = await params;
  return {
    title: `Calendario de la temporada ${seasonId}`,
    description: `Partidos, fechas y sedes de la temporada ${seasonId} en SportsLeague.`,
  };
}

function Notice({ children }: { children: React.ReactNode }) {
  return <p className="mt-6 rounded-lg border border-line bg-surface p-5 text-muted">{children}</p>;
}

export default async function CalendarioPage({ params }: PageProps<"/calendario/[seasonId]">) {
  await connection(); // se genera en cada peticion con los datos actuales del Fixture Service
  const { seasonId } = await params;

  // Fixture Service: GET /fixtures/{seasonId}
  const matches = await getJson<Match[]>(`${serviceUrl("fixture")}/api/v1/fixtures/${seasonId}`);

  let body: React.ReactNode;
  if (matches === null) {
    body = (
      <Notice>
        El Fixture Service no respondió. Si está en el plan gratuito de Render puede estar despertando: recarga en
        un minuto.
      </Notice>
    );
  } else if (matches.length === 0) {
    body = <Notice>La temporada {seasonId} todavía no tiene calendario.</Notice>;
  } else {
    // Team Service: GET /teams/{id} para mostrar el nombre de cada equipo
    const ids = [...new Set(matches.flatMap((m) => [m.homeTeam, m.awayTeam]))];
    const teams = await Promise.all(ids.map((id) => getJson<Team>(`${serviceUrl("team")}/api/v1/teams/${id}`)));
    const names = new Map(teams.filter((t): t is Team => t !== null).map((t) => [t.id, t.name]));
    const name = (id: number) => names.get(id) ?? `Equipo ${id}`;
    const dates = [...new Set(matches.map((m) => utcDate(m.scheduledAt)))].sort();

    body = (
      <div className="mt-6 space-y-6">
        {dates.map((date, i) => (
          <section key={date} className="rounded-lg border border-line bg-surface p-5">
            <h2 className="font-display text-xl font-bold text-async">
              Jornada {i + 1}: {utcDay(date)} {date}
            </h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[520px] table-fixed text-left text-sm">
                <thead className="text-muted">
                  <tr>
                    <th className="w-[30%] py-2 pr-4 font-semibold">Local</th>
                    <th className="w-[30%] py-2 pr-4 font-semibold">Visitante</th>
                    <th className="w-[25%] py-2 pr-4 font-semibold">Sede</th>
                    <th className="py-2 font-semibold">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {matches
                    .filter((m) => utcDate(m.scheduledAt) === date)
                    .map((m) => (
                      <tr key={m.id} className="border-t border-line">
                        <td className="py-2 pr-4">{name(m.homeTeam)}</td>
                        <td className="py-2 pr-4">{name(m.awayTeam)}</td>
                        <td className="py-2 pr-4">{m.venue}</td>
                        <td className="py-2">{m.status}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    );
  }

  return (
    <main>
      <Link href="/" className="text-sm text-sync hover:underline">
        Volver al inicio
      </Link>
      <h1 className="mt-3 font-display text-4xl font-bold">Calendario de la temporada {seasonId}</h1>
      {body}
    </main>
  );
}
