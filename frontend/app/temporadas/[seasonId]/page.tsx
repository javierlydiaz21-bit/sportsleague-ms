import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import Crest from "@/components/crest";
import MatchRow from "@/components/match-row";
import StandingsTable, { FormGuide } from "@/components/standings-table";
import Tabs from "@/components/tabs";
import { Notice } from "@/components/ui";
import { findSeason, formByTeam, seasonMatches, teamsById } from "@/lib/server-data";
import { getJson, utcDate, utcDay } from "@/lib/services";
import type { Player, Standings, TopScorer } from "@/lib/types";

const SPORT_LABEL: Record<string, string> = { futbol: "Fútbol", basquet: "Básquet", voley: "Vóley" };
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
    description: `Partidos, resultados, tabla de posiciones y goleadores de ${name} en SportsLeague.`,
  };
}

export default async function SeasonPage({ params, searchParams }: PageProps<"/temporadas/[seasonId]">) {
  await connection(); // pagina generada en el servidor (SSR) con los datos actuales
  const seasonId = Number((await params).seasonId);
  if (!Number.isInteger(seasonId) || seasonId < 1) notFound();
  const { tab } = await searchParams;

  const [found, matches, standings, scorers] = await Promise.all([
    findSeason(seasonId),
    seasonMatches(seasonId),
    getJson<Standings>(`/standings/${seasonId}`),
    getJson<TopScorer[]>(`/top-scorers/${seasonId}`),
  ]);
  const teams = await teamsById([
    ...(matches ?? []).flatMap((m) => [m.homeTeam, m.awayTeam]),
    ...(standings?.standings ?? []).map((s) => s.teamId),
  ]);
  const names = new Map([...teams].map(([id, t]) => [id, t.name]));
  const name = (id: number) => names.get(id) ?? `Equipo ${id}`;
  const players = new Map<number, Player & { teamName: string }>();
  for (const t of teams.values()) for (const p of t.players ?? []) players.set(p.id, { ...p, teamName: t.name });
  const form = formByTeam(matches ?? []);

  const category = found?.league.categories.length === 1 ? found.league.categories[0] : undefined;
  const title = found ? found.league.name : `Temporada ${seasonId}`;
  const jornadas = [...new Set((matches ?? []).map((m) => m.jornada))].sort((a, b) => a - b);
  const played = (matches ?? []).filter((m) => m.status === "finalizado").length;

  const partidos =
    matches && matches.length > 0 ? (
      <div className="space-y-4 p-4">
        {jornadas.map((j) => {
          const list = matches.filter((m) => m.jornada === j).sort((a, b) => a.id - b.id);
          const date = utcDate(list[0].scheduledAt);
          return (
            <section key={j} className="overflow-hidden rounded-lg border border-line">
              <h3 className="flex justify-between border-b border-line bg-surface-2 px-3 py-2 text-sm font-semibold">
                <span>Jornada {j}</span>
                <span className="font-normal capitalize text-muted">
                  {utcDay(date)} {date.slice(8, 10)}/{date.slice(5, 7)}
                </span>
              </h3>
              <div className="divide-y divide-line">
                {list.map((m) => (
                  <MatchRow key={m.id} match={m} home={name(m.homeTeam)} away={name(m.awayTeam)} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    ) : (
      <p className="p-6 text-sm text-muted">La temporada todavía no tiene calendario.</p>
    );

  const posiciones =
    standings && standings.standings.length > 0 ? (
      <div className="pb-2">
        <StandingsTable rows={standings.standings} names={names} form={form} />
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 pt-3 text-xs text-muted">
          <span className="flex items-center gap-2">
            <span aria-hidden className="h-3 w-1 rounded bg-ok" /> Líder
          </span>
          <span>Desempate por {TIEBREAKER_LABEL[standings.tiebreakerCriteria] ?? standings.tiebreakerCriteria}</span>
          <span className="flex items-center gap-2">
            Últimos 5: <FormGuide results={["G", "E", "P"]} /> ganó, empató, perdió
          </span>
        </p>
      </div>
    ) : (
      <p className="p-6 text-sm text-muted">La tabla aparece cuando se publica el calendario de la temporada.</p>
    );

  const goleadores =
    scorers && scorers.length > 0 ? (
      <ol className="divide-y divide-line">
        {scorers.map((s) => {
          const p = players.get(s.playerId);
          return (
            <li key={s.playerId} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span className="w-5 text-right text-muted tabular-nums">{s.position}</span>
              {p && <Crest name={p.teamName} size={22} />}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{p ? (p.name ?? `Camiseta ${p.jerseyNumber}`) : `Jugador ${s.playerId}`}</span>
                <span className="block truncate text-xs text-muted">
                  {p ? `${p.teamName} · #${p.jerseyNumber}` : ""}
                </span>
              </span>
              <span className="font-display text-2xl font-bold tabular-nums">{s.goals}</span>
              <span className="w-8 text-xs text-muted">{s.goals === 1 ? "gol" : "goles"}</span>
            </li>
          );
        })}
      </ol>
    ) : (
      <p className="p-6 text-sm text-muted">Todavía no hay goles en partidos finalizados.</p>
    );

  return (
    <main className="space-y-4">
      <Link href="/" className="text-sm text-sync hover:underline">
        ‹ Partidos
      </Link>

      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        <header className="flex items-center gap-4 p-5">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-surface-2">
            <svg aria-hidden viewBox="0 0 24 24" className="h-8 w-8 text-async" fill="currentColor">
              <path d="M7 3h10v2h3v3a4 4 0 0 1-4 4h-.3A5 5 0 0 1 13 14.9V17h3v2H8v-2h3v-2.1A5 5 0 0 1 8.3 12H8a4 4 0 0 1-4-4V5h3V3Zm0 4H6v1a2 2 0 0 0 1.2 1.8A5 5 0 0 1 7 8.5V7Zm10 0v1.5c0 .5 0 .9-.2 1.3A2 2 0 0 0 18 8V7h-1Z" />
            </svg>
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl">{title}</h1>
            <p className="text-sm text-muted">
              {[
                found && (SPORT_LABEL[found.league.sport] ?? found.league.sport),
                category && `${category.name} (${category.ageRange} años)`,
                found && `Temporada ${found.season.year}`,
                matches && `${teams.size} equipos · ${played} de ${matches.length} partidos jugados`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </header>
        {matches === null && (
          <div className="px-5 pb-4">
            <Notice tone="error">
              No pudimos cargar la temporada. Si la web estuvo un rato sin uso, los servicios están despertando: recarga en
              un minuto.
            </Notice>
          </div>
        )}
        <Tabs
          initial={typeof tab === "string" ? tab : undefined}
          tabs={[
            { id: "partidos", label: "Partidos", content: partidos },
            { id: "posiciones", label: "Posiciones", content: posiciones },
            { id: "goleadores", label: "Goleadores", content: goleadores },
          ]}
        />
      </div>
    </main>
  );
}
