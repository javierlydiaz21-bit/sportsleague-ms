"use client";

/*
 * 6. Estadísticas (diseño: viewEstadisticas, ruta #/estadisticas). Por el API Gateway:
 *   Fixture + Live Score .. GET /fixtures/{seasonId}, GET /live-matches?status=...   partidos, marcadores e indicadores
 *   Team Service .......... GET /teams?ids={ids}                                    equipos y camisetas
 *   Statistics Service .... GET /standings/{seasonId}                               tabla de posiciones
 *                           GET /top-scorers/{seasonId}                             goleadores
 *                           GET /players/{id}/disciplinary-record                   tarjetas acumuladas
 *   Analytics Service ..... GET /analytics/attendance?seasonId={id}                 asistencia estimada
 *                           GET /analytics/season-trend/{seasonId}                  evolución del rendimiento
 *                           GET /analytics/suspended-matches?seasonId={id}          motivo de cada suspensión
 *                           GET /analytics/summary, POST /analytics/etl/run         proceso ETL (fuera del diseño)
 */

import { useState } from "react";
import { Spark } from "@/components/charts";
import Crest from "@/components/crest";
import { useLeague } from "@/components/league-context";
import StandingsTable from "@/components/standings-table";
import { EmptyCard, FormMessage } from "@/components/ui";
import { seasonMatches } from "@/lib/server-data";
import { TIEBREAKER_LABEL, shortDate, utcDate } from "@/lib/services";
import { api } from "@/lib/session";
import { useApi, useLoad } from "@/lib/use-api";
import type { League, Match, Season, Standings, Team, TopScorer } from "@/lib/types";
import { PanelSection } from "./panel";
import { today } from "./shared";

interface Summary {
  lastRun: { status: string; finishedAt: string | null; errors: string[] } | null;
}
interface Disciplinary {
  playerId: number;
  yellowCards: number;
  redCards: number;
}
interface Trend {
  points: Array<{ teamId: number; matchNumber: number; points: number }>;
}
const RUN_LABEL: Record<string, string> = { ok: "completa", parcial: "parcial", error: "con error" };

export default function StatisticsSection() {
  return (
    <PanelSection id="estadisticas" intro="Se recalculan cada vez que termina un partido o se corrige un acta.">
      <Statistics />
    </PanelSection>
  );
}

/** Cantidad de partidos de cada temporada, para elegir la temporada inicial. */
async function loadSeasons(league: League) {
  const lists = await Promise.all(league.seasons.map((s) => api<Match[]>("GET", `/fixtures/${s.id}`).catch(() => [] as Match[])));
  return new Map(league.seasons.map((s, i) => [s.id, lists[i].length]));
}

/** Todo lo de la temporada elegida. */
async function loadStats(seasonId: number) {
  const matches = (await seasonMatches(seasonId)) ?? [];
  const ids = [...new Set(matches.flatMap((m) => [m.homeTeam, m.awayTeam]))];
  const [teams, standings, scorers, attendance, suspended, trend] = await Promise.all([
    ids.length ? api<Team[]>("GET", `/teams?ids=${ids.join(",")}`).catch(() => [] as Team[]) : Promise.resolve([] as Team[]),
    api<Standings>("GET", `/standings/${seasonId}`).catch(() => null),
    api<TopScorer[]>("GET", `/top-scorers/${seasonId}`).catch(() => [] as TopScorer[]),
    api<{ average: number }>("GET", `/analytics/attendance?seasonId=${seasonId}`).catch(() => null),
    api<{ matches: Array<{ matchId: number; reason: string }> }>("GET", `/analytics/suspended-matches?seasonId=${seasonId}`).catch(() => null),
    api<Trend>("GET", `/analytics/season-trend/${seasonId}`).catch(() => null),
  ]);
  const players = teams.flatMap((t) => t.players ?? []);
  const records = await Promise.all(
    players.map((p) => api<Disciplinary>("GET", `/players/${p.id}/disciplinary-record`).catch(() => null)),
  );
  const cards = records
    .filter((r): r is Disciplinary => Boolean(r && (r.yellowCards || r.redCards)))
    .sort((a, b) => b.redCards - a.redCards || b.yellowCards - a.yellowCards || a.playerId - b.playerId);
  return {
    matches,
    teams,
    standings,
    scorers,
    cards,
    avgAttendance: attendance ? Math.round(attendance.average) : 0,
    reasons: new Map((suspended?.matches ?? []).map((s) => [s.matchId, s.reason])),
    trend: trend?.points ?? [],
  };
}

function defaultSeason(seasons: Season[], counts: Map<number, number>) {
  const t = today();
  const withMatches = seasons.filter((s) => counts.get(s.id));
  const current = withMatches.find((s) => utcDate(s.startDate) <= t && t <= utcDate(s.endDate));
  return (current ?? withMatches.at(-1) ?? seasons.at(-1))!.id;
}

function Statistics() {
  const { leagues, league } = useLeague();
  const seasons = [...(league?.seasons ?? [])].sort((a, b) => a.year - b.year || a.id - b.id);
  const counts = useLoad(league ? `estadisticas-temporadas:${league.id}:${seasons.length}` : null, () => loadSeasons(league!));
  const [choice, setChoice] = useState<{ league: number; season: number } | null>(null);
  const sid = league && counts.data && seasons.length ? (choice?.league === league.id ? choice.season : defaultSeason(seasons, counts.data)) : null;
  const stats = useLoad(sid && counts.data?.get(sid) ? `estadisticas:${sid}` : null, () => loadStats(sid!));

  if (!leagues || (league && seasons.length && !counts.data)) return <p className="empty">Cargando...</p>;
  if (!league || !sid) {
    return (
      <EmptyCard
        title="Todavía no hay temporadas"
        text="Crea una temporada y genera su calendario para ver estadísticas."
        href="/ligas"
        label="Ir a Ligas y reglamento"
      />
    );
  }
  const season = seasons.find((s) => s.id === sid)!;
  const tools = (
    <div className="toolbar">
      <label className="fl">
        Temporada
        <select value={sid} onChange={(e) => setChoice({ league: league.id, season: Number(e.target.value) })}>
          {seasons.map((s) => (
            <option key={s.id} value={s.id}>
              {s.year}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
  if (!counts.data?.get(sid)) {
    return (
      <>
        {tools}
        <EmptyCard
          title={`La temporada ${season.year} todavía no tiene calendario`}
          text="Genéralo para empezar a ver estadísticas."
          href="/calendario"
          label="Ir a Calendario"
        />
        <EtlCard />
      </>
    );
  }
  if (!stats.data) return <>{tools}<p className="empty">{stats.error || "Cargando..."}</p></>;

  const d = stats.data;
  const names = new Map(d.teams.map((t) => [t.id, t.name]));
  const name = (id: number) => names.get(id) ?? `Equipo ${id}`;
  const players = new Map(d.teams.flatMap((t) => (t.players ?? []).map((p) => [p.id, p] as const)));
  const played = d.matches.filter((m) => m.status === "finalizado").length;
  const suspended = d.matches.filter((m) => m.status === "suspendido").sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const categoryId = d.teams.find((t) => t.id === d.matches[0]?.homeTeam)?.categoryId;
  const rule = league.categories.find((c) => c.id === categoryId)?.rule;
  const rows = d.standings?.standings ?? [];

  // Evolución: puntos acumulados de cada equipo después de cada partido jugado
  const lines = [...new Set(d.trend.map((p) => p.teamId))]
    .map((id) => {
      const pts = d.trend.filter((p) => p.teamId === id).sort((a, b) => a.matchNumber - b.matchNumber);
      return { teamId: id, series: [0, ...pts.map((p) => p.points)], points: pts.at(-1)?.points ?? 0 };
    })
    .sort((a, b) => b.points - a.points);
  const max = Math.max(1, ...lines.map((l) => l.points));

  return (
    <>
      {tools}
      <div className="stats">
        <div className="stat">
          <b>
            {played} de {d.matches.length}
          </b>
          <span>partidos jugados</span>
        </div>
        <div className="stat">
          <b>{d.avgAttendance}</b>
          <span>personas por partido en promedio (asistencia estimada)</span>
        </div>
        <div className="stat">
          <b>{suspended.length}</b>
          <span>{suspended.length === 1 ? "partido suspendido" : "partidos suspendidos"}</span>
        </div>
      </div>

      <section className="card">
        <h2>Tabla de posiciones</h2>
        <StandingsTable rows={rows} names={names} />
        {rows.length > 0 && rule && (
          <p className="rule-note">
            Victoria {rule.pointsWin} puntos, empate {rule.pointsDraw}. Desempate por{" "}
            {TIEBREAKER_LABEL[rule.tiebreakerCriteria] ?? rule.tiebreakerCriteria}. La tabla se actualiza al terminar cada partido.
          </p>
        )}
      </section>

      <div className="cols">
        <section className="card">
          <h2>Tarjetas acumuladas</h2>
          {d.cards.length ? (
            <div className="scroll">
              <table className="data">
                <thead>
                  <tr>
                    <th>Jugador</th>
                    <th className="num">Amarillas</th>
                    <th className="num">Rojas</th>
                  </tr>
                </thead>
                <tbody>
                  {d.cards.slice(0, 10).map((c) => {
                    const p = players.get(c.playerId);
                    return (
                      <tr key={c.playerId}>
                        <td>
                          <span className="team-cell">
                            {p && <Crest name={name(p.teamId)} id={p.teamId} size={26} />}
                            {p ? `#${p.jerseyNumber}, ${name(p.teamId)}` : `Jugador ${c.playerId}`}
                          </span>
                        </td>
                        <td className="num">{c.yellowCards}</td>
                        <td className="num">{c.redCards}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty">Aún no hay tarjetas en partidos finalizados.</p>
          )}
        </section>
        <section className="card">
          <h2>Goleadores</h2>
          {d.scorers.length ? (
            <ol className="rank">
              {d.scorers.slice(0, 10).map((s, i) => {
                const p = players.get(s.playerId);
                return (
                  <li key={s.playerId}>
                    <span className="n">{i + 1}</span>
                    {p ? <Crest name={name(p.teamId)} id={p.teamId} size={28} /> : <span />}
                    <span className="who">
                      <b>{p ? `Camiseta #${p.jerseyNumber}` : `Jugador ${s.playerId}`}</b>
                      <span>{p ? name(p.teamId) : ""}</span>
                    </span>
                    <span className="val">{s.goals}</span>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="empty">Aún no hay goles en partidos finalizados.</p>
          )}
        </section>
      </div>

      <section className="card">
        <h2>Evolución del rendimiento</h2>
        <p className="hint">Puntos acumulados por jornada de cada equipo.</p>
        {lines.length ? (
          <div className="trends">
            {lines.map((l) => (
              <div className="trend" key={l.teamId}>
                <Crest name={name(l.teamId)} id={l.teamId} size={26} />
                <em>{name(l.teamId)}</em>
                <Spark series={l.series} max={max} label={`${name(l.teamId)}: ${l.series.slice(1).join(", ")} puntos`} />
                <b>{l.points}</b>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty">Aparece cuando se finalizan partidos y corre el ETL.</p>
        )}
      </section>

      {suspended.length > 0 && (
        <section className="card">
          <h2>Partidos suspendidos</h2>
          <div className="scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Partido</th>
                  <th>Motivo</th>
                </tr>
              </thead>
              <tbody>
                {suspended.map((m) => (
                  <tr key={m.id}>
                    <td>{shortDate(m.scheduledAt)}</td>
                    <td>
                      {name(m.homeTeam)} contra {name(m.awayTeam)}
                    </td>
                    <td>{d.reasons.get(m.id) ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <EtlCard onDone={stats.reload} />
    </>
  );
}

/** Proceso ETL del Analytics Service (fuera del diseño): actualiza asistencia, rendimiento y suspendidos. */
function EtlCard({ onDone }: { onDone?: () => void }) {
  const summary = useApi<Summary>("/analytics/summary");
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const run = summary.data?.lastRun;
  const at = run?.finishedAt
    ? `, a las ${new Date(run.finishedAt).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" })}`
    : "";
  const last = run ? `Última corrida: ${RUN_LABEL[run.status] ?? run.status}${at}` : "El ETL aún no ha corrido";
  return (
    <section className="card">
      <h2>Proceso ETL de analítica</h2>
      <p className="hint">
        El Analytics Service lee réplicas de solo lectura de Fixture, Live Score y Statistics y calcula la asistencia, el
        rendimiento y los suspendidos. {last.endsWith(".") ? last : `${last}.`}
      </p>
      <div className="factions">
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              // Analytics Service: POST /analytics/etl/run
              const r = await api<{ status: string }>("POST", "/analytics/etl/run");
              setMsg({ tone: "ok", text: `ETL ejecutado: corrida ${RUN_LABEL[r.status] ?? r.status}.` });
              summary.reload();
              onDone?.();
            } catch (err) {
              setMsg({ tone: "error", text: (err as Error).message });
            } finally {
              setBusy(false);
            }
          }}
        >
          Ejecutar ETL ahora
        </button>
      </div>
      <FormMessage message={msg} />
    </section>
  );
}
