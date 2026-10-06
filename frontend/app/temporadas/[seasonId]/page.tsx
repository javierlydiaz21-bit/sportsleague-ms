import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Notice, Section, StatusBadge } from "@/components/ui";
import { findSeason, liveScores, teamName, teamsById } from "@/lib/server-data";
import { getJson, utcDate, utcDay } from "@/lib/services";
import type { Match, Player, Standings, TopScorer } from "@/lib/types";

const TIEBREAKER_LABEL: Record<string, string> = {
  diferencia_de_goles: "diferencia de goles",
  goles_a_favor: "goles a favor",
  partidos_ganados: "partidos ganados",
};

export async function generateMetadata({ params }: PageProps<"/temporadas/[seasonId]">): Promise<Metadata> {
  const { seasonId } = await params;
  const found = await findSeason(Number(seasonId));
  const name = found ? `${found.league.name} ${found.season.year}` : `Temporada ${seasonId}`;
  return {
    title: name,
    description: `Calendario, resultados, tabla de posiciones y goleadores de ${name} en SportsLeague.`,
  };
}

export default async function SeasonPage({ params }: PageProps<"/temporadas/[seasonId]">) {
  await connection(); // pagina generada en el servidor (SSR) con los datos actuales
  const seasonId = Number((await params).seasonId);
  if (!Number.isInteger(seasonId) || seasonId < 1) notFound();

  const [found, matches, standings, scorers, scores] = await Promise.all([
    findSeason(seasonId),
    getJson<Match[]>(`/fixtures/${seasonId}`),
    getJson<Standings>(`/standings/${seasonId}`),
    getJson<TopScorer[]>(`/top-scorers/${seasonId}`),
    liveScores(),
  ]);
  const teams = await teamsById([
    ...(matches ?? []).flatMap((m) => [m.homeTeam, m.awayTeam]),
    ...(standings?.standings ?? []).map((s) => s.teamId),
  ]);
  const players = new Map<number, Player & { teamName: string }>();
  for (const t of teams.values()) for (const p of t.players ?? []) players.set(p.id, { ...p, teamName: t.name });
  const playerLabel = (id: number) => {
    const p = players.get(id);
    return p ? `${p.name ?? `Camiseta ${p.jerseyNumber}`}` : `Jugador ${id}`;
  };

  const dates = [...new Set((matches ?? []).map((m) => utcDate(m.scheduledAt)))].sort();
  const title = found ? `${found.league.name}, temporada ${found.season.year}` : `Temporada ${seasonId}`;

  return (
    <main className="space-y-6">
      <div>
        <Link href="/" className="text-sm text-sync hover:underline">
          Volver al inicio
        </Link>
        <h1 className="mt-2 font-display text-4xl font-bold">{title}</h1>
        {found && (
          <p className="text-muted">
            Del {utcDate(found.season.startDate)} al {utcDate(found.season.endDate)}
          </p>
        )}
      </div>

      {matches === null && (
        <Notice tone="error">
          No se pudo consultar el calendario. Si los servicios están en el plan gratuito de Render pueden estar
          despertando: recarga en un minuto.
        </Notice>
      )}

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Section
          id="posiciones"
          title="Tabla de posiciones"
          description={
            standings
              ? `Se recalcula sola al cerrar cada partido. Desempate por ${TIEBREAKER_LABEL[standings.tiebreakerCriteria] ?? standings.tiebreakerCriteria}.`
              : undefined
          }
        >
          {standings && standings.standings.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[460px] text-left text-sm tabular-nums">
                <thead className="text-muted">
                  <tr>
                    <th className="py-2 pr-2 font-semibold">#</th>
                    <th className="py-2 pr-3 font-semibold">Equipo</th>
                    <th className="py-2 pr-2 text-right font-semibold" title="Partidos jugados">PJ</th>
                    <th className="py-2 pr-2 text-right font-semibold" title="Ganados">G</th>
                    <th className="py-2 pr-2 text-right font-semibold" title="Empatados">E</th>
                    <th className="py-2 pr-2 text-right font-semibold" title="Perdidos">P</th>
                    <th className="py-2 pr-2 text-right font-semibold" title="Goles a favor y en contra">GF:GC</th>
                    <th className="py-2 pr-2 text-right font-semibold" title="Diferencia de goles">DG</th>
                    <th className="py-2 text-right font-semibold">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.standings.map((s) => (
                    <tr key={s.teamId} className="border-t border-line">
                      <td className="py-2 pr-2 text-muted">{s.position}</td>
                      <td className="py-2 pr-3 font-semibold">{teamName(teams, s.teamId)}</td>
                      <td className="py-2 pr-2 text-right">{s.played}</td>
                      <td className="py-2 pr-2 text-right">{s.wins}</td>
                      <td className="py-2 pr-2 text-right">{s.draws}</td>
                      <td className="py-2 pr-2 text-right">{s.losses}</td>
                      <td className="py-2 pr-2 text-right">
                        {s.goalsFor}:{s.goalsAgainst}
                      </td>
                      <td className="py-2 pr-2 text-right">{s.goalDifference > 0 ? `+${s.goalDifference}` : s.goalDifference}</td>
                      <td className="py-2 text-right font-display text-lg font-bold">{s.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted">La tabla aparece cuando se publica el calendario de la temporada.</p>
          )}
        </Section>

        <Section id="goleadores" title="Goleadores">
          {scorers && scorers.length > 0 ? (
            <ol className="space-y-2 text-sm">
              {scorers.map((s) => (
                <li key={s.playerId} className="flex items-center gap-3 border-b border-line pb-2 last:border-0">
                  <span className="w-5 text-muted tabular-nums">{s.position}</span>
                  <span className="flex-1">
                    <span className="font-semibold">{playerLabel(s.playerId)}</span>
                    <span className="block text-xs text-muted">{players.get(s.playerId)?.teamName ?? ""}</span>
                  </span>
                  <span className="font-display text-xl font-bold tabular-nums">{s.goals}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted">Todavía no hay goles registrados en partidos finalizados.</p>
          )}
        </Section>
      </div>

      <Section id="calendario" title="Calendario" description="Toca un partido para seguir su marcador en vivo.">
        {matches && matches.length > 0 ? (
          <div className="space-y-5">
            {dates.map((date, i) => (
              <div key={date}>
                <h3 className="font-display text-lg font-bold text-async">
                  Jornada {i + 1}: {utcDay(date)} {date}
                </h3>
                <ul className="mt-2 divide-y divide-line rounded-md border border-line bg-surface-2">
                  {matches
                    .filter((m) => utcDate(m.scheduledAt) === date)
                    .map((m) => {
                      const score = scores.get(m.id)?.score;
                      return (
                        <li key={m.id}>
                          <Link
                            href={`/partidos/${m.id}`}
                            className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-3 py-3 text-sm hover:bg-surface sm:grid-cols-[1fr_auto_1fr_10rem_7rem]"
                          >
                            <span className="text-right font-semibold">{teamName(teams, m.homeTeam)}</span>
                            <span className="min-w-14 rounded bg-surface px-2 py-1 text-center font-display text-lg font-bold tabular-nums">
                              {score ? `${score.home} - ${score.away}` : "vs"}
                            </span>
                            <span className="font-semibold">{teamName(teams, m.awayTeam)}</span>
                            <span className="col-span-3 text-muted sm:col-span-1">{m.venue}</span>
                            <span className="col-span-3 sm:col-span-1 sm:text-right">
                              <StatusBadge status={m.status} />
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          matches && <p className="text-sm text-muted">La temporada todavía no tiene calendario.</p>
        )}
      </Section>
    </main>
  );
}
