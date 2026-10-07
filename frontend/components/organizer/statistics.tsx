"use client";

import { useState } from "react";
import { BarList, Spark } from "@/components/charts";
import Crest from "@/components/crest";
import StandingsTable from "@/components/standings-table";
import { Card, EmptyCard, Notice } from "@/components/ui";
import { formByTeam, seasonMatches } from "@/lib/server-data";
import { TIEBREAKER_LABEL } from "@/lib/services";
import { api } from "@/lib/session";
import { useAction, useApi, useLoad } from "@/lib/use-api";
import type { League, Standings, Team, TopScorer } from "@/lib/types";
import OrganizerSection from "./panel";
import { SeasonPicker, defaultSeasonId, flatten, useAllMatches } from "./shared";

interface Summary {
  totalMatches: number;
  scheduled: number;
  live: number;
  played: number;
  suspended: number;
  totalAttendance: number;
  averageAttendance: number;
  lastRun: { status: string; finishedAt: string | null; errors: string[] } | null;
}
interface Attendance {
  total: number;
  average: number;
  matches: Array<{ matchId: number; estimatedAttendance: number }>;
}
interface Suspended {
  count: number;
  matches: Array<{ matchId: number; reason: string }>;
}
interface Trend {
  points: Array<{ teamId: number; matchNumber: number; points: number; trendMetric: number }>;
}

const RUN_LABEL: Record<string, string> = { ok: "completa", parcial: "parcial", error: "con error" };

function etlText(run: Summary["lastRun"]) {
  if (!run) return "El ETL aún no ha corrido";
  const at = run.finishedAt
    ? `, a las ${new Date(run.finishedAt).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" })}`
    : "";
  return `Última corrida del ETL: ${RUN_LABEL[run.status] ?? run.status}${at}`;
}
/** Cierra con punto, sin duplicarlo (la hora en es-CO ya termina en "a. m."). */
const sentence = (text: string) => (text.endsWith(".") ? text : `${text}.`);

export default function StatisticsSection() {
  return <OrganizerSection id="estadisticas">{({ leagues }) => <Statistics leagues={leagues} />}</OrganizerSection>;
}

function Statistics({ leagues }: { leagues: League[] }) {
  const { seasons } = flatten(leagues);
  const all = useAllMatches(leagues);
  const [choice, setChoice] = useState<number | null>(null);
  const seasonId = all.data ? (choice ?? defaultSeasonId(seasons, all.data.matches)) : null;
  const q = seasonId ? `seasonId=${seasonId}` : null;

  // Analytics Service (ETL sobre réplicas de solo lectura) y Statistics Service
  const summary = useApi<Summary>("/analytics/summary");
  const attendance = useApi<Attendance>(q && `/analytics/attendance?${q}`);
  const suspended = useApi<Suspended>(q && `/analytics/suspended-matches?${q}`);
  const trend = useApi<Trend>(seasonId ? `/analytics/season-trend/${seasonId}` : null);
  const season = useLoad(seasonId ? `stats:${seasonId}` : null, async () => {
    const [standings, scorers, matches] = await Promise.all([
      api<Standings>("GET", `/standings/${seasonId}`).catch(() => null),
      api<TopScorer[]>("GET", `/top-scorers/${seasonId}`).catch(() => [] as TopScorer[]),
      seasonMatches(seasonId!),
    ]);
    const ids = [...new Set([...(standings?.standings ?? []).map((s) => s.teamId), ...(matches ?? []).flatMap((m) => [m.homeTeam, m.awayTeam])])];
    const teams = ids.length ? await api<Team[]>("GET", `/teams?ids=${ids.join(",")}`) : [];
    return { standings, scorers, matches: matches ?? [], teams };
  });
  const { busy, message, run } = useAction();

  if (!seasons.length) {
    return (
      <EmptyCard
        title="Todavía no hay temporadas"
        text="Crea una temporada y genera su calendario para ver estadísticas."
        href="/organizador/ligas"
        label="Ir a Ligas y reglamento"
      />
    );
  }

  const teams = season.data?.teams ?? [];
  const names = new Map(teams.map((t) => [t.id, t.name]));
  const teamName = (id: number) => names.get(id) ?? all.data?.names.get(id) ?? `Equipo ${id}`;
  const players = new Map(teams.flatMap((t) => (t.players ?? []).map((p) => [p.id, { ...p, teamName: t.name }] as const)));
  const matchLabel = (id: number) => {
    const m = all.data?.matches.find((x) => x.id === id);
    return m ? `${teamName(m.homeTeam)} contra ${teamName(m.awayTeam)}` : `Partido #${id}`;
  };

  // Una línea por equipo con el mismo máximo, para comparar su evolución
  const teamIds = [...new Set((trend.data?.points ?? []).map((p) => p.teamId))];
  const lines = teamIds
    .map((id) => {
      const pts = (trend.data?.points ?? []).filter((p) => p.teamId === id).sort((a, b) => a.matchNumber - b.matchNumber);
      return { id, series: [0, ...pts.map((p) => p.points)], points: pts.at(-1)?.points ?? 0 };
    })
    .sort((a, b) => b.points - a.points || teamName(a.id).localeCompare(teamName(b.id)));
  const max = Math.max(1, ...lines.map((l) => l.points));
  const longest = Math.max(0, ...lines.map((l) => l.series.length - 1));

  const s = summary.data;
  const reloadAll = () => {
    summary.reload();
    attendance.reload();
    suspended.reload();
    trend.reload();
  };

  return (
    <>
      <div className="toolbar">
        <SeasonPicker seasons={seasons} value={seasonId} onChange={setChoice} />
        <button
          type="button"
          className="btn btn-green"
          disabled={busy}
          onClick={async () => {
            if (
              await run(async () => {
                const r = await api<{ status: string }>("POST", "/analytics/etl/run");
                return `ETL ejecutado: corrida ${RUN_LABEL[r.status] ?? r.status}.`;
              })
            )
              reloadAll();
          }}
        >
          Ejecutar ETL ahora
        </button>
      </div>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      {summary.error && <Notice tone="error">{summary.error}</Notice>}

      {s && (
        <section aria-label="Indicadores de la liga">
          <div className="stats">
            <div className="stat">
              <b>
                {s.played} de {s.totalMatches}
              </b>
              <span>partidos jugados{s.live ? `, ${s.live} en juego` : ""}</span>
            </div>
            <div className="stat">
              <b>{s.averageAttendance.toLocaleString("es-CO")}</b>
              <span>personas por partido en promedio (asistencia estimada)</span>
            </div>
            <div className="stat">
              <b>{s.suspended}</b>
              <span>{s.suspended === 1 ? "partido suspendido" : "partidos suspendidos"}</span>
            </div>
          </div>
          <p className="rule-note">
            Toda la liga. {sentence(etlText(s.lastRun))}
            {s.lastRun?.errors.length ? ` Réplicas sin responder: ${s.lastRun.errors.join("; ")}` : ""}
          </p>
        </section>
      )}

      <Card title="Tabla de posiciones">
        {season.data?.standings && season.data.standings.standings.length > 0 ? (
          <>
            <StandingsTable rows={season.data.standings.standings} names={names} form={formByTeam(season.data.matches)} />
            <p className="rule-note">
              Desempate por{" "}
              {TIEBREAKER_LABEL[season.data.standings.tiebreakerCriteria] ?? season.data.standings.tiebreakerCriteria}.
            </p>
          </>
        ) : (
          <p className="empty">{season.loading ? "Cargando..." : "La tabla aparece cuando se publica el calendario de la temporada."}</p>
        )}
      </Card>

      <div className="cols">
        <Card title="Evolución del rendimiento" hint="Puntos acumulados de cada equipo después de cada partido jugado.">
          {lines.length > 0 ? (
            <>
              <div className="trends">
                {lines.map((l) => (
                  <div className="trend" key={l.id}>
                    <Crest name={teamName(l.id)} size={26} />
                    <em>{teamName(l.id)}</em>
                    <Spark series={l.series} max={max} label={`${teamName(l.id)}: ${l.series.slice(1).join(", ")} puntos`} />
                    <b>{l.points}</b>
                  </div>
                ))}
              </div>
              <details className="details-table">
                <summary>Ver como tabla</summary>
                <div className="scroll">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>Equipo</th>
                        {Array.from({ length: longest }, (_, i) => (
                          <th key={i} className="num">
                            P{i + 1}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((l) => (
                        <tr key={l.id}>
                          <td>{teamName(l.id)}</td>
                          {l.series.slice(1).map((v, i) => (
                            <td key={i} className="num">
                              {v}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </>
          ) : (
            <p className="empty">Aparece cuando se finalizan partidos y corre el ETL.</p>
          )}
        </Card>

        <Card title="Goleadores">
          {season.data && season.data.scorers.length > 0 ? (
            <ol className="rank">
              {season.data.scorers.slice(0, 10).map((x: TopScorer) => {
                const p = players.get(x.playerId);
                return (
                  <li key={x.playerId}>
                    <span className="n">{x.position}</span>
                    {p ? <Crest name={p.teamName} size={28} /> : <span />}
                    <span className="who">
                      <b>{p ? (p.name ?? `Camiseta #${p.jerseyNumber}`) : `Jugador ${x.playerId}`}</b>
                      <span>{p ? `${p.teamName}, camiseta #${p.jerseyNumber}` : ""}</span>
                    </span>
                    <span className="val">{x.goals}</span>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="empty">Aún no hay goles en partidos finalizados.</p>
          )}
        </Card>
      </div>

      <div className="cols">
        <Card
          title="Asistencia estimada"
          hint="Pico de espectadores que siguieron el marcador en vivo, por el factor de asistencia configurado."
        >
          {attendance.data && attendance.data.matches.length > 0 ? (
            <BarList
              unit="personas"
              rows={attendance.data.matches.map((m) => ({ id: m.matchId, label: matchLabel(m.matchId), value: m.estimatedAttendance }))}
            />
          ) : (
            <p className="empty">Sin datos: abre el marcador de un partido en vivo y ejecuta el ETL.</p>
          )}
        </Card>

        <Card title="Partidos suspendidos">
          {suspended.data && suspended.data.matches.length > 0 ? (
            <ul className="notes">
              {suspended.data.matches.map((m) => (
                <li key={m.matchId}>
                  <b>{matchLabel(m.matchId)}</b>
                  <span className="text-muted">{m.reason}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">Ningún partido suspendido en esta temporada.</p>
          )}
        </Card>
      </div>
    </>
  );
}
