import Link from "next/link";
import { connection } from "next/server";
import { Icon } from "@/components/icons";
import { MatchTile } from "@/components/match-row";
import StandingsTable from "@/components/standings-table";
import { Band, Card, Notice, Page } from "@/components/ui";
import { Competition, MatchView, allCompetitions, dayLabel, teamsById, today } from "@/lib/server-data";
import { SPORT_LABEL, cap, getJson, longDate, utcDate } from "@/lib/services";
import type { Standings } from "@/lib/types";

function CompetitionCard({ c, matches, names }: { c: Competition; matches: MatchView[]; names: Map<number, string> }) {
  const jornadas = [...new Set(matches.map((m) => m.jornada))];
  return (
    <Card
      title={<Link href={`/temporadas/${c.season.id}`}>{c.league.name}</Link>}
      hint={[c.category?.name, `Temporada ${c.season.year}`, jornadas.length === 1 ? `Jornada ${jornadas[0]}` : null]
        .filter(Boolean)
        .join(", ")}
      actions={<Link href={`/temporadas/${c.season.id}?tab=tabla`}>Ver tabla</Link>}
    >
      <div className="tiles">
        {matches.map((m) => (
          <MatchTile
            key={m.id}
            match={m}
            home={names.get(m.homeTeam) ?? `Equipo ${m.homeTeam}`}
            away={names.get(m.awayTeam) ?? `Equipo ${m.awayTeam}`}
          />
        ))}
      </div>
    </Card>
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

  // Tabla destacada: la competición del primer partido en vivo, o la más reciente
  const seasons = [...competitions].sort((a, b) => b.season.id - a.season.id);
  const featured = seasons.find((c) => c.matches.some((m) => m.status === "en_curso")) ?? groups[0]?.c ?? seasons[0];
  const standings = featured ? await getJson<Standings>(`/standings/${featured.season.id}`) : null;

  const href = (q: Record<string, string>) => `/?${new URLSearchParams(q).toString()}`;
  const dayText = vista === "envivo" ? "Partidos jugándose ahora" : cap(`${selected === t ? "hoy, " : ""}${longDate(selected)}`);

  return (
    <>
      <Band icon="balon" title="Partidos" intro={`${dayText}. Resultados, partidos en vivo y tablas de las ligas.`}>
        <nav className="pill-tabs on-navy" aria-label="Filtro">
          <Link href={href({ fecha: selected })} aria-current={vista === "todos" ? "page" : undefined}>
            Todos
          </Link>
          <Link href={href({ vista: "envivo" })} aria-current={vista === "envivo" ? "page" : undefined}>
            <span aria-hidden className="live-dot" />
            En vivo{liveCount > 0 && ` (${liveCount})`}
          </Link>
        </nav>
      </Band>
      <Page>
        {vista === "todos" && dates.length > 0 && (
          <nav aria-label="Fechas" className="dates">
            {prev ? (
              <Link href={href({ fecha: prev })} aria-label="Fecha anterior" className="arrow">
                ‹
              </Link>
            ) : (
              <span className="arrow" aria-hidden>
                ‹
              </span>
            )}
            <ul>
              {visibleDates.map((d) => (
                <li key={d}>
                  <Link href={href({ fecha: d })} aria-current={d === selected ? "date" : undefined}>
                    <b>{dayLabel(d)}</b>
                    {d.slice(8, 10)}/{d.slice(5, 7)}
                  </Link>
                </li>
              ))}
            </ul>
            {next ? (
              <Link href={href({ fecha: next })} aria-label="Fecha siguiente" className="arrow">
                ›
              </Link>
            ) : (
              <span className="arrow" aria-hidden>
                ›
              </span>
            )}
          </nav>
        )}

        {!ok && (
          <Notice tone="error">
            No pudimos cargar los partidos. Si la web estuvo un rato sin uso, los servicios están despertando: recarga en
            un minuto.
          </Notice>
        )}

        <div className="cols">
          <div className="stack">
            {groups.length > 0
              ? groups.map(({ c, matches }) => <CompetitionCard key={c.season.id} c={c} matches={matches} names={names} />)
              : ok && (
                  <Card
                    title={vista === "envivo" ? "No hay partidos en juego" : "No hay partidos este día"}
                    hint={
                      vista === "envivo"
                        ? "Cuando empiece un partido, aquí verás su marcador en vivo."
                        : "Elige otra fecha para ver sus partidos y resultados."
                    }
                  />
                )}
          </div>

          <aside className="stack">
            {featured && standings && standings.standings.length > 0 && (
              <Card
                title="Tabla de posiciones"
                hint={`${featured.league.name}, ${featured.category?.name ?? `temporada ${featured.season.year}`}`}
                actions={<Link href={`/temporadas/${featured.season.id}?tab=tabla`}>Completa</Link>}
              >
                <StandingsTable rows={standings.standings.slice(0, 6)} names={names} compact />
              </Card>
            )}

            <Card title="Competiciones">
              {seasons.length > 0 ? (
                <ul className="team-list">
                  {seasons.map((c) => (
                    <li key={c.season.id}>
                      <Link href={`/temporadas/${c.season.id}`}>
                        <span className="ico">
                          <Icon id="ligas" />
                        </span>
                        <span className="two">
                          {c.league.name}
                          <span>
                            {[SPORT_LABEL[c.league.sport] ?? c.league.sport, c.category?.name, `temporada ${c.season.year}`]
                              .filter(Boolean)
                              .join(", ")}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="empty">Todavía no hay competiciones.</p>
              )}
            </Card>
          </aside>
        </div>
      </Page>
    </>
  );
}
