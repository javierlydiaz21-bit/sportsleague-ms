"use client";

/*
 * Inicio del panel (diseño: viewInicio, ruta #/inicio). Todo pasa por el API Gateway:
 *   League Service ........ GET /leagues (useLeague)          liga activa, temporadas, categorías y reglamento
 *   Team Service .......... GET /teams?categoryId={id}        equipos y jugadores de cada categoría
 *   Referee Service ....... GET /referees                     árbitros certificados en las categorías de la liga
 *   Fixture Service ....... GET /fixtures/{seasonId}          partidos de cada temporada
 *   Live Score Service .... GET /live-matches?status=..., GET /matches/{id}/live   marcador y minuto en vivo
 *   Statistics Service .... GET /standings/{seasonId}         tabla de posiciones
 *   Analytics Service ..... GET /analytics/attendance?seasonId={id}   asistencia estimada
 *   Notification Service .. GET /notifications/{userId}       avisos recientes
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, Icon, Pitch } from "@/components/icons";
import { useLeague } from "@/components/league-context";
import { MatchTile } from "@/components/match-row";
import StandingsTable from "@/components/standings-table";
import { EmptyCard, LoginRequired, Notice } from "@/components/ui";
import { seasonMatches, type MatchView } from "@/lib/server-data";
import { SECTIONS, type SectionId } from "@/lib/sections";
import { SPORT_LABEL, TIEBREAKER_LABEL, cap, longDate, shortDate, utcDate } from "@/lib/services";
import { api, useSession } from "@/lib/session";
import { useLoad } from "@/lib/use-api";
import type { League, Match, NotificationFeed, Referee, Season, Standings, Team } from "@/lib/types";
import { today } from "./shared";

const STEPS: SectionId[] = ["ligas", "equipos", "arbitros", "calendario"];
const KIND: Record<string, string> = {
  horario_confirmado: "Horario confirmado",
  cambio_de_sede: "Cambio de sede",
  resultado_final: "Resultado final",
  partido_suspendido: "Partido suspendido",
  prueba: "Prueba",
};
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Equipos, árbitros y partidos de la liga activa. */
async function loadLeague(league: League) {
  const categoryIds = new Set(league.categories.map((c) => c.id));
  const [teamLists, referees, fixtures] = await Promise.all([
    // Team Service: GET /teams?categoryId={id}
    Promise.all(league.categories.map((c) => api<Team[]>("GET", `/teams?categoryId=${c.id}`).catch(() => [] as Team[]))),
    // Referee Service: GET /referees
    api<Referee[]>("GET", "/referees").catch(() => [] as Referee[]),
    // Fixture Service: GET /fixtures/{seasonId}
    Promise.all(league.seasons.map((s) => api<Match[]>("GET", `/fixtures/${s.id}`).catch(() => [] as Match[]))),
  ]);
  const teams = teamLists.flat();
  return {
    teams,
    teamsPerCategory: teamLists.map((t) => t.length),
    referees: referees.filter((r) => r.categoriesCertified.some((c) => categoryIds.has(c))),
    matches: fixtures.flat(),
  };
}

/** Jornada, tabla, asistencia y avisos de una temporada. */
async function loadSeason(seasonId: number, userId: number) {
  const [matches, standings, attendance, feed] = await Promise.all([
    seasonMatches(seasonId), // Fixture Service + Live Score Service
    api<Standings>("GET", `/standings/${seasonId}`).catch(() => null), // Statistics Service
    api<{ average: number }>("GET", `/analytics/attendance?seasonId=${seasonId}`).catch(() => null), // Analytics Service
    api<NotificationFeed>("GET", `/notifications/${userId}`).catch(() => null), // Notification Service
  ]);
  return {
    matches: matches ?? [],
    standings,
    avgAttendance: attendance ? Math.round(attendance.average) : 0,
    notes: feed?.notifications ?? [],
  };
}

/** Temporada que se muestra al entrar: la que se está jugando, si no la última con calendario. */
function defaultSeason(seasons: Season[], matches: Match[]) {
  const list = [...seasons].sort((a, b) => a.year - b.year || a.id - b.id);
  if (!list.length) return null;
  const t = today();
  const withMatches = list.filter((s) => matches.some((m) => m.seasonId === s.id));
  const current = withMatches.find((s) => utcDate(s.startDate) <= t && t <= utcDate(s.endDate));
  return (current ?? withMatches.at(-1) ?? list.at(-1))!.id;
}

export default function PanelHome() {
  const { user, ready } = useSession();
  const router = useRouter();
  const { league, leagues, error } = useLeague();
  const overview = useLoad(league ? `inicio:${league.id}:${league.seasons.length}:${league.categories.length}` : null, () =>
    loadLeague(league!),
  );
  const [choice, setChoice] = useState<{ league: number; season: number } | null>(null);
  const seasonId =
    league && overview.data
      ? choice?.league === league.id
        ? choice.season
        : defaultSeason(league.seasons, overview.data.matches)
      : null;
  const season = useLoad(seasonId && user ? `inicio-temporada:${seasonId}` : null, () => loadSeason(seasonId!, user!.id));

  // Sin sesión se va a iniciar sesión, como en el diseño
  useEffect(() => {
    if (ready && !user) router.replace("/entrar");
  }, [ready, user, router]);

  if (!ready || !user) return null;
  if (user.role !== "organizador") return <LoginRequired role="organizadores" />;

  const o = overview.data;
  const categories = league?.categories ?? [];
  const seasons = [...(league?.seasons ?? [])].sort((a, b) => a.year - b.year || a.id - b.id);
  const st: Record<string, boolean> = {
    ligas: seasons.length > 0 && categories.some((c) => c.rule),
    equipos: Boolean(o?.teamsPerCategory.some((n) => n >= 2)),
    arbitros: Boolean(o && o.referees.length > 0),
    calendario: Boolean(o && o.matches.length > 0),
  };
  const done = STEPS.filter((s) => st[s]).length;
  const next = STEPS.find((s) => !st[s]);
  const setup = Boolean(o || (leagues && !league)) && done < STEPS.length;
  const first = user.name.trim().split(/\s+/)[0];

  const kitStat = (id: SectionId) => {
    if (id === "ligas") return `${plural(seasons.length, "temporada", "temporadas")}, ${plural(categories.length, "categoría", "categorías")}`;
    if (id === "publico") return "Abrir el sitio de la liga";
    if (!o) return "";
    const live = o.matches.filter((m) => m.status === "en_curso").length;
    const fin = o.matches.filter((m) => m.status === "finalizado").length;
    switch (id) {
      case "equipos":
        return `${o.teams.length} equipos, ${o.teams.reduce((n, t) => n + (t.players?.length ?? 0), 0)} jugadores`;
      case "arbitros":
        return plural(o.referees.length, "árbitro", "árbitros");
      case "calendario":
        return o.matches.length ? `${o.matches.length} partidos` : "Sin calendario";
      case "partidos":
        return live ? `${live} en curso, ${fin} finalizados` : `${fin} finalizados`;
      default:
        return fin ? "Al día con el último partido" : "Aún sin partidos jugados";
    }
  };

  return (
    <>
      <section className="hello">
        <Pitch />
        <div className="wrap">
          <div>
            <h1>Hola, {first}</h1>
            <p>
              {league
                ? `${league.name}, ${(SPORT_LABEL[league.sport] ?? league.sport).toLowerCase()}.`
                : leagues
                  ? "Crea tu liga en Ligas y reglamento."
                  : ""}
              {setup && " En cuatro pasos tu liga queda lista para jugar."}
            </p>
          </div>
          {setup && (
            <div className="progress" role="img" aria-label={`${done} de ${STEPS.length} pasos listos`}>
              <div className="progress-bar">
                {STEPS.map((s) => (
                  <span key={s} className={st[s] ? "on" : ""} />
                ))}
              </div>
              <p>
                <b>
                  {done} de {STEPS.length}
                </b>{" "}
                pasos para poner en marcha tu liga
              </p>
            </div>
          )}
        </div>
      </section>

      <main className="page">
        <div className="wrap stack">
          {error && <Notice tone="error">{error}</Notice>}
          <section>
            <div className="squad-title">
              <h2>Secciones</h2>
              <p>Todo lo de tu liga, en un solo lugar.</p>
            </div>
            <div className="kits">
              {SECTIONS.map((s, i) => (
                <Link
                  key={s.id}
                  className={`kit${s.id === "publico" ? " public" : ""}`}
                  href={s.href}
                  style={{ "--i": i } as React.CSSProperties}
                >
                  <span className="kit-top">
                    <span className="kit-icon">
                      <Icon id={s.id} />
                    </span>
                    {setup &&
                      STEPS.includes(s.id) &&
                      (st[s.id] ? (
                        <span className="badge done">
                          <Check />
                          Listo
                        </span>
                      ) : (
                        s.id === next && <span className="badge next">Siguiente paso</span>
                      ))}
                  </span>
                  <span className="kit-name">{s.label}</span>
                  <span className="kit-desc">{s.desc}</span>
                  <span className="kit-stat">{kitStat(s.id)}</span>
                </Link>
              ))}
            </div>
          </section>

          {o && o.matches.length > 0 && seasonId && (
            <SeasonSummary
              league={league!}
              seasons={seasons}
              seasonId={seasonId}
              onSeason={(id) => setChoice({ league: league!.id, season: id })}
              data={season.data}
              loading={season.loading}
              teams={o.teams}
              leagueMatchIds={new Set(o.matches.map((m) => m.id))}
            />
          )}
        </div>
      </main>
    </>
  );
}

function SeasonPick({ seasons, value, onChange }: { seasons: Season[]; value: number; onChange: (id: number) => void }) {
  return (
    <label className="fl">
      Temporada
      <select value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {seasons.map((s) => (
          <option key={s.id} value={s.id}>
            {s.year}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Jornada actual, indicadores, tabla y avisos de la temporada elegida. */
function SeasonSummary({
  league,
  seasons,
  seasonId,
  onSeason,
  data,
  loading,
  teams,
  leagueMatchIds,
}: {
  league: League;
  seasons: Season[];
  seasonId: number;
  onSeason: (id: number) => void;
  data: Awaited<ReturnType<typeof loadSeason>> | null;
  loading: boolean;
  teams: Team[];
  leagueMatchIds: Set<number>;
}) {
  const pick = <SeasonPick seasons={seasons} value={seasonId} onChange={onSeason} />;
  const year = seasons.find((s) => s.id === seasonId)?.year;
  if (!data) {
    return (
      <>
        <div className="toolbar">{pick}</div>
        <p className="empty">{loading ? "Cargando la jornada..." : "No pudimos cargar la temporada."}</p>
      </>
    );
  }
  if (!data.matches.length) {
    return (
      <>
        <div className="toolbar">{pick}</div>
        <EmptyCard
          title={`La temporada ${year} todavía no tiene calendario`}
          text="Genéralo para ver aquí la jornada, la tabla y los indicadores."
          href="/calendario"
          label="Ir a Calendario"
        />
      </>
    );
  }

  const names = new Map(teams.map((t) => [t.id, t.name]));
  const name = (id: number) => names.get(id) ?? `Equipo ${id}`;
  const sorted = [...data.matches].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt) || a.id - b.id);
  const rounds: MatchView[][] = [];
  for (const m of sorted) {
    const last = rounds.at(-1);
    if (last && utcDate(last[0].scheduledAt) === utcDate(m.scheduledAt)) last.push(m);
    else rounds.push([m]);
  }
  const t = today();
  const found = rounds.findIndex((g) => utcDate(g[0].scheduledAt) >= t);
  const ci = found === -1 ? rounds.length - 1 : found;
  const d = utcDate(rounds[ci][0].scheduledAt);
  const played = sorted.filter((m) => m.status === "finalizado").length;
  const suspended = sorted.filter((m) => m.status === "suspendido").length;
  const categoryId = teams.find((x) => x.id === sorted[0].homeTeam)?.categoryId;
  const rule = league.categories.find((c) => c.id === categoryId)?.rule;
  const notes = data.notes
    .filter((n) => n.matchId !== null && leagueMatchIds.has(n.matchId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id)
    .slice(0, 6);

  return (
    <>
      <section className="card">
        <div className="head">
          <div>
            <h2>
              Jornada {ci + 1} de {rounds.length}
            </h2>
            <p>{cap((d === t ? "hoy, " : "") + longDate(d))}</p>
          </div>
          {pick}
        </div>
        <div className="tiles">
          {rounds[ci].map((m) => (
            <MatchTile key={m.id} match={m} home={name(m.homeTeam)} away={name(m.awayTeam)} href={`/partidos/${m.id}`} />
          ))}
        </div>
      </section>

      <div className="stats">
        <div className="stat">
          <b>
            {played} de {sorted.length}
          </b>
          <span>partidos jugados</span>
        </div>
        <div className="stat">
          <b>{data.avgAttendance}</b>
          <span>personas por partido en promedio (asistencia estimada)</span>
        </div>
        <div className="stat">
          <b>{suspended}</b>
          <span>{suspended === 1 ? "partido suspendido" : "partidos suspendidos"}</span>
        </div>
      </div>

      <div className="cols">
        <section className="card">
          <div className="head">
            <h2>Tabla de posiciones</h2>
            <Link href="/estadisticas">Ver estadísticas</Link>
          </div>
          <StandingsTable rows={data.standings?.standings ?? []} names={names} compact />
          {rule && (data.standings?.standings.length ?? 0) > 0 && (
            <p className="rule-note">
              Victoria {rule.pointsWin} puntos, empate {rule.pointsDraw}. Desempate por{" "}
              {TIEBREAKER_LABEL[rule.tiebreakerCriteria] ?? rule.tiebreakerCriteria}. La tabla se actualiza al terminar cada
              partido.
            </p>
          )}
        </section>
        <section className="card">
          <h2>Avisos recientes</h2>
          {notes.length ? (
            <ul className="notes">
              {notes.map((n) => (
                <li key={n.id}>
                  <span className="meta">
                    <span className="kind">{KIND[n.type] ?? n.title}</span>
                    <time dateTime={n.createdAt}>{shortDate(n.createdAt)}</time>
                  </span>
                  <span>{n.body}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">Todavía no se ha enviado ningún aviso.</p>
          )}
        </section>
      </div>
    </>
  );
}
