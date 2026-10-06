import Link from "next/link";
import { connection } from "next/server";
import MatchRow from "@/components/match-row";
import StandingsTable from "@/components/standings-table";
import { Notice } from "@/components/ui";
import { Competition, MatchView, allCompetitions, dayLabel, teamsById, today } from "@/lib/server-data";
import { getJson, utcDate } from "@/lib/services";
import type { Standings } from "@/lib/types";

const SPORT_LABEL: Record<string, string> = { futbol: "Fútbol", basquet: "Básquet", voley: "Vóley" };

function Trophy() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-async" fill="currentColor">
      <path d="M7 3h10v2h3v3a4 4 0 0 1-4 4h-.3A5 5 0 0 1 13 14.9V17h3v2H8v-2h3v-2.1A5 5 0 0 1 8.3 12H8a4 4 0 0 1-4-4V5h3V3Zm0 4H6v1a2 2 0 0 0 1.2 1.8A5 5 0 0 1 7 8.5V7Zm10 0v1.5c0 .5 0 .9-.2 1.3A2 2 0 0 0 18 8V7h-1Z" />
    </svg>
  );
}

function CompetitionCard({ c, matches, names }: { c: Competition; matches: MatchView[]; names: Map<number, string> }) {
  const jornadas = [...new Set(matches.map((m) => m.jornada))];
  return (
    <section className="overflow-hidden rounded-lg border border-line bg-surface">
      <header className="flex items-center justify-between gap-3 border-b border-line bg-surface-2 px-3 py-2">
        <Link href={`/temporadas/${c.season.id}`} className="flex min-w-0 items-center gap-2 hover:underline">
          <Trophy />
          <span className="truncate text-sm font-semibold">{c.league.name}</span>
          <span className="hidden shrink-0 text-xs text-muted sm:inline">
            {[c.category?.name, jornadas.length === 1 ? `Jornada ${jornadas[0]}` : null].filter(Boolean).join(" · ")}
          </span>
        </Link>
        <Link href={`/temporadas/${c.season.id}?tab=posiciones`} className="shrink-0 text-xs font-semibold text-sync hover:underline">
          Tabla
        </Link>
      </header>
      <div className="divide-y divide-line">
        {matches.map((m) => (
          <MatchRow key={m.id} match={m} home={names.get(m.homeTeam) ?? `Equipo ${m.homeTeam}`} away={names.get(m.awayTeam) ?? `Equipo ${m.awayTeam}`} />
        ))}
      </div>
    </section>
  );
}

export default async function Home({ searchParams }: PageProps<"/">) {
  await connection(); // datos actuales en cada visita
  const params = await searchParams;
  const vista = params.vista === "envivo" ? "envivo" : "todos";
  const fecha = typeof params.fecha === "string" ? params.fecha : undefined;

  const { competitions, ok } = await allCompetitions();
  const all = competitions.flatMap((c) => c.matches);
  const teams = await teamsById(all.flatMap((m) => [m.homeTeam, m.awayTeam]));
  const names = new Map([...teams].map(([id, t]) => [id, t.name]));

  const t = today();
  const dates = [...new Set(all.map((m) => utcDate(m.scheduledAt)))].sort();
  const selected =
    fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : dates.includes(t) ? t : (dates.find((d) => d >= t) ?? dates.at(-1) ?? t);
  const index = dates.indexOf(selected);
  const start = Math.min(Math.max(0, index - 3), Math.max(0, dates.length - 7));
  const visibleDates = dates.slice(start, start + 7);
  const prev = index > 0 ? dates[index - 1] : null;
  const next = index >= 0 && index < dates.length - 1 ? dates[index + 1] : null;

  const liveCount = all.filter((m) => m.status === "en_curso").length;
  const groups = competitions
    .map((c) => ({
      c,
      matches: c.matches
        .filter((m) => (vista === "envivo" ? m.status === "en_curso" : utcDate(m.scheduledAt) === selected))
        .sort((a, b) => a.id - b.id),
    }))
    .filter((g) => g.matches.length > 0)
    .sort((a, b) => b.c.season.id - a.c.season.id);

  // Mini tabla: la competicion del primer partido en vivo, o la mas reciente
  const seasons = [...competitions].sort((a, b) => b.season.id - a.season.id);
  const featured = seasons.find((c) => c.matches.some((m) => m.status === "en_curso")) ?? groups[0]?.c ?? seasons[0];
  const standings = featured ? await getJson<Standings>(`/standings/${featured.season.id}`) : null;

  const href = (q: Record<string, string>) => `/?${new URLSearchParams(q).toString()}`;

  return (
    <main className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-4">
        <h1 className="sr-only">Partidos</h1>

        {/* Selector de fechas */}
        <nav aria-label="Fechas" className="flex items-center gap-1 rounded-lg border border-line bg-surface p-1">
          {prev ? (
            <Link href={href({ fecha: prev })} aria-label="Fecha anterior" className="rounded-md px-2 py-2 text-muted hover:bg-surface-2 hover:text-ink">
              ‹
            </Link>
          ) : (
            <span className="px-2 py-2 text-line">‹</span>
          )}
          <div className="scroll-x flex flex-1 gap-1">
            {visibleDates.map((d) => {
              const active = vista === "todos" && d === selected;
              return (
                <Link
                  key={d}
                  href={href({ fecha: d })}
                  aria-current={active ? "date" : undefined}
                  className={`min-w-[4.5rem] flex-1 rounded-md px-2 py-1.5 text-center text-sm transition-colors ${
                    active ? "bg-sync font-semibold text-pitch" : "text-muted hover:bg-surface-2 hover:text-ink"
                  }`}
                >
                  <span className="block font-semibold">{dayLabel(d)}</span>
                  <span className="block text-xs opacity-80">{d.slice(8, 10)}/{d.slice(5, 7)}</span>
                </Link>
              );
            })}
          </div>
          {next ? (
            <Link href={href({ fecha: next })} aria-label="Fecha siguiente" className="rounded-md px-2 py-2 text-muted hover:bg-surface-2 hover:text-ink">
              ›
            </Link>
          ) : (
            <span className="px-2 py-2 text-line">›</span>
          )}
        </nav>

        {/* Filtro Todos / En vivo */}
        <div className="flex gap-2">
          <Link
            href={href({ fecha: selected })}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${vista === "todos" ? "bg-ink text-pitch" : "border border-line text-muted hover:text-ink"}`}
          >
            Todos
          </Link>
          <Link
            href={href({ vista: "envivo" })}
            className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold ${
              vista === "envivo" ? "bg-live text-pitch" : "border border-line text-muted hover:text-ink"
            }`}
          >
            <span aria-hidden className={`h-2 w-2 rounded-full ${vista === "envivo" ? "bg-pitch" : "live-dot bg-live"}`} />
            En vivo {liveCount > 0 && <span className="tabular-nums">({liveCount})</span>}
          </Link>
        </div>

        {!ok && (
          <Notice tone="error">
            No pudimos cargar los partidos. Si la web estuvo un rato sin uso, los servicios están despertando: recarga en
            un minuto.
          </Notice>
        )}

        {groups.length > 0
          ? groups.map(({ c, matches }) => <CompetitionCard key={c.season.id} c={c} matches={matches} names={names} />)
          : ok && (
              <p className="rounded-lg border border-line bg-surface p-6 text-center text-sm text-muted">
                {vista === "envivo" ? "No hay partidos en juego en este momento." : "No hay partidos programados para este día."}
              </p>
            )}
      </div>

      {/* Barra lateral */}
      <aside className="space-y-4">
        {featured && standings && standings.standings.length > 0 && (
          <section className="overflow-hidden rounded-lg border border-line bg-surface">
            <header className="border-b border-line bg-surface-2 px-3 py-2">
              <h2 className="text-sm font-semibold">Tabla de posiciones</h2>
              <p className="truncate text-xs text-muted">
                {featured.league.name} · {featured.category?.name ?? featured.season.year}
              </p>
            </header>
            <StandingsTable rows={standings.standings.slice(0, 6)} names={names} compact seasonId={featured.season.id} />
          </section>
        )}

        <section className="overflow-hidden rounded-lg border border-line bg-surface">
          <h2 className="border-b border-line bg-surface-2 px-3 py-2 text-sm font-semibold">Competiciones</h2>
          {seasons.length > 0 ? (
            <ul className="divide-y divide-line">
              {seasons.map((c) => (
                <li key={c.season.id}>
                  <Link href={`/temporadas/${c.season.id}`} className="flex items-center gap-3 px-3 py-2.5 hover:bg-surface-2">
                    <Trophy />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{c.league.name}</span>
                      <span className="block truncate text-xs text-muted">
                        {[SPORT_LABEL[c.league.sport] ?? c.league.sport, c.category?.name, `Temporada ${c.season.year}`]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-4 text-sm text-muted">Todavía no hay competiciones.</p>
          )}
        </section>
      </aside>
    </main>
  );
}
