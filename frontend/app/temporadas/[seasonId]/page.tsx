import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Fragment } from "react";
import Crest from "@/components/crest";
import { Pitch } from "@/components/icons";
import MatchRow, { MatchTile } from "@/components/match-row";
import StandingsTable, { FormGuide } from "@/components/standings-table";
import { Card, Page } from "@/components/ui";
import { MatchView, findSeason, formByTeam, seasonMatches, teamsById, today } from "@/lib/server-data";
import { SPORT_LABEL, TIEBREAKER_LABEL, cap, getJson, longDate, utcDate } from "@/lib/services";
import type { Player, Standings, TopScorer } from "@/lib/types";

// Pestañas del sitio público; las anteriores (partidos, posiciones, goleadores) siguen funcionando
const TABS = [
  { id: "jornada", label: "Jornada" },
  { id: "calendario", label: "Calendario" },
  { id: "tabla", label: "Tabla" },
] as const;
type TabId = (typeof TABS)[number]["id"];
const LEGACY: Record<string, TabId> = { partidos: "calendario", posiciones: "tabla", goleadores: "tabla" };

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
  await connection(); // página generada en el servidor (SSR) con los datos actuales
  const seasonId = Number((await params).seasonId);
  if (!Number.isInteger(seasonId) || seasonId < 1) notFound();
  const query = (await searchParams).tab;
  const requested = typeof query === "string" ? query : "";
  const tab: TabId = TABS.some((t) => t.id === requested) ? (requested as TabId) : (LEGACY[requested] ?? "jornada");

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

  const category = found?.league.categories.length === 1 ? found.league.categories[0] : undefined;
  const list = [...(matches ?? [])].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt) || a.id - b.id);
  const jornadas = [...new Set(list.map((m) => m.jornada))].sort((a, b) => a - b);
  const byJornada = (j: number) => list.filter((m) => m.jornada === j);
  const played = list.filter((m) => m.status === "finalizado").length;
  const t = today();

  const rows = (ms: MatchView[], compact = false) =>
    ms.map((m) => <MatchRow key={m.id} match={m} home={name(m.homeTeam)} away={name(m.awayTeam)} compact={compact} />);
  const dateOf = (j: number) => utcDate(byJornada(j)[0].scheduledAt);
  const dayText = (j: number) => cap(`${dateOf(j) === t ? "hoy, " : ""}${longDate(dateOf(j))}`);

  const tabla =
    standings && standings.standings.length > 0 ? (
      <>
        <StandingsTable rows={standings.standings} names={names} form={formByTeam(list)} compact={tab === "jornada"} />
        <p className="rule-note">
          {category?.rule
            ? `Victoria ${category.rule.pointsWin} puntos, empate ${category.rule.pointsDraw}. `
            : ""}
          Desempate por {TIEBREAKER_LABEL[standings.tiebreakerCriteria] ?? standings.tiebreakerCriteria}. La tabla se
          actualiza al terminar cada partido.
          {tab === "tabla" && (
            <>
              {" "}
              Últimos 5: <FormGuide results={["G", "E", "P"]} /> ganó, empató, perdió.
            </>
          )}
        </p>
      </>
    ) : (
      <p className="empty">La tabla aparece cuando se publica el calendario de la temporada.</p>
    );

  const goleadores = (n: number) =>
    scorers && scorers.length > 0 ? (
      <ol className="rank">
        {scorers.slice(0, n).map((s) => {
          const p = players.get(s.playerId);
          return (
            <li key={s.playerId}>
              <span className="n">{s.position}</span>
              {p ? <Crest name={p.teamName} size={28} /> : <span />}
              <span className="who">
                <b>{p ? (p.name ?? `Camiseta #${p.jerseyNumber}`) : `Jugador ${s.playerId}`}</b>
                <span>{p ? `${p.teamName}, camiseta #${p.jerseyNumber}` : ""}</span>
              </span>
              <span className="val" aria-label={`${s.goals} ${s.goals === 1 ? "gol" : "goles"}`}>
                {s.goals}
              </span>
            </li>
          );
        })}
      </ol>
    ) : (
      <p className="empty">Aún no hay goles en partidos finalizados.</p>
    );

  let body: React.ReactNode;
  if (jornadas.length === 0) {
    body = (
      <Card
        title={matches === null ? "No pudimos cargar la temporada" : "Esta temporada todavía no tiene calendario"}
        hint={
          matches === null
            ? "Si la web estuvo un rato sin uso, los servicios están despertando: recarga en un minuto."
            : "Cuando la liga lo publique, aquí aparecerán los partidos, los resultados y la tabla."
        }
      />
    );
  } else if (tab === "calendario") {
    body = (
      <Card title="Calendario" actions={<p className="text-muted">{`${jornadas.length} jornadas, ${list.length} partidos`}</p>}>
        {jornadas.map((j) => (
          <Fragment key={j}>
            <div className="round-head">
              <h3>Jornada {j}</h3>
              <p>{dayText(j)}</p>
            </div>
            {rows(byJornada(j))}
          </Fragment>
        ))}
      </Card>
    );
  } else if (tab === "tabla") {
    body = (
      <>
        <Card title="Tabla de posiciones">{tabla}</Card>
        <Card title="Goleadores">{goleadores(10)}</Card>
      </>
    );
  } else {
    // Jornada actual: la de hoy o la próxima; si la temporada terminó, la última
    const current = jornadas.find((j) => dateOf(j) >= t) ?? jornadas[jornadas.length - 1];
    const prev = jornadas[jornadas.indexOf(current) - 1];
    body = (
      <>
        <Card title={`Jornada ${current}`} actions={<p className="text-muted">{dayText(current)}</p>}>
          <div className="tiles">
            {byJornada(current).map((m) => (
              <MatchTile key={m.id} match={m} home={name(m.homeTeam)} away={name(m.awayTeam)} />
            ))}
          </div>
        </Card>
        <div className="cols">
          <Card title="Tabla de posiciones" actions={<Link href={`/temporadas/${seasonId}?tab=tabla`}>Ver tabla completa</Link>}>
            {tabla}
          </Card>
          <div className="stack">
            <Card title="Goleadores">{goleadores(5)}</Card>
            {prev && <Card title={`Jornada ${prev}`}>{rows(byJornada(prev), true)}</Card>}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <header className="pub-head">
        <Pitch />
        <div className="wrap">
          <div className="pub-title">
            <div>
              <p className="eyebrow">
                <Link href="/">‹ Todos los partidos</Link>
              </p>
              <h1>{found ? found.league.name : `Temporada ${seasonId}`}</h1>
              <p>
                {[
                  found && (SPORT_LABEL[found.league.sport] ?? found.league.sport),
                  category && `categoría ${category.name} (${category.ageRange} años)`,
                  found && `temporada ${found.season.year}`,
                  list.length > 0 && `${played} de ${list.length} partidos jugados`,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            </div>
            {found && found.league.seasons.length > 1 && (
              <nav className="pick" aria-label="Temporadas">
                Temporada
                <span className="pill-tabs on-navy">
                  {[...found.league.seasons]
                    .sort((a, b) => a.year - b.year || a.id - b.id)
                    .map((s) => (
                      <Link key={s.id} href={`/temporadas/${s.id}`} aria-current={s.id === seasonId ? "page" : undefined}>
                        {s.year}
                      </Link>
                    ))}
                </span>
              </nav>
            )}
          </div>
          <nav className="pub-tabs" aria-label="Secciones de la temporada">
            {TABS.map((x) => (
              <Link
                key={x.id}
                href={x.id === "jornada" ? `/temporadas/${seasonId}` : `/temporadas/${seasonId}?tab=${x.id}`}
                aria-current={tab === x.id ? "page" : undefined}
              >
                {x.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <Page>{body}</Page>
    </>
  );
}
