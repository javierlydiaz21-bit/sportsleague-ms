"use client";

import { useEffect, useState } from "react";
import { BarList, LineChart, OTHER_COLOR, SERIES_COLORS, Series } from "@/components/charts";
import { LoginRequired, Notice, Section } from "@/components/ui";
import { api, useSession } from "@/lib/session";
import { useAction, useApi } from "@/lib/use-api";
import type { League, Match, Team } from "@/lib/types";

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

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export default function AnalyticsPage() {
  const { user, ready } = useSession();
  const isOrganizer = user?.role === "organizador";
  const leagues = useApi<League[]>(isOrganizer ? "/leagues" : null);
  const seasons = (leagues.data ?? []).flatMap((l) => l.seasons.map((s) => ({ ...s, leagueName: l.name })));
  const [seasonChoice, setSeasonChoice] = useState("");
  const seasonId = seasonChoice || (seasons.length ? String(Math.max(...seasons.map((s) => s.id))) : "");

  const summary = useApi<Summary>(isOrganizer ? "/analytics/summary" : null);
  const attendance = useApi<Attendance>(isOrganizer && seasonId ? `/analytics/attendance?seasonId=${seasonId}` : null);
  const suspended = useApi<Suspended>(isOrganizer && seasonId ? `/analytics/suspended-matches?seasonId=${seasonId}` : null);
  const trend = useApi<Trend>(isOrganizer && seasonId ? `/analytics/season-trend/${seasonId}` : null);
  const fixture = useApi<Match[]>(seasonId ? `/fixtures/${seasonId}` : null);
  const [teams, setTeams] = useState<Map<number, string>>(new Map());
  const { busy, message, run } = useAction();

  useEffect(() => {
    if (!fixture.data?.length) return;
    let cancelled = false;
    const ids = [...new Set(fixture.data.flatMap((m) => [m.homeTeam, m.awayTeam]))];
    api<Team[]>("GET", `/teams?ids=${ids.join(",")}`)
      .then((list) => {
        if (!cancelled) setTeams(new Map(list.map((t) => [t.id, t.name])));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [fixture.data]);

  if (!ready) return null;
  if (!isOrganizer) return <LoginRequired role="organizadores" />;

  const teamName = (id: number) => teams.get(id) ?? `Equipo ${id}`;
  const matchLabel = (id: number) => {
    const m = fixture.data?.find((x) => x.id === id);
    return m ? `${teamName(m.homeTeam)} vs ${teamName(m.awayTeam)}` : `Partido #${id}`;
  };

  // Una linea por equipo; el color sigue al equipo (orden por id), nunca a su posicion
  const teamIds = [...new Set((trend.data?.points ?? []).map((p) => p.teamId))].sort((a, b) => a - b);
  const series: Series[] = teamIds.map((id, i) => ({
    id,
    label: teamName(id),
    color: SERIES_COLORS[i] ?? OTHER_COLOR,
    points: (trend.data?.points ?? []).filter((p) => p.teamId === id).map((p) => ({ x: p.matchNumber, y: p.points })),
  }));
  const s = summary.data;

  const reloadAll = () => {
    summary.reload();
    attendance.reload();
    suspended.reload();
    trend.reload();
  };

  return (
    <main className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold">Analítica de la liga</h1>
          <p className="mt-1 max-w-2xl text-muted">
            Analytics Service: un proceso ETL periódico lee réplicas de solo lectura de Fixture, Live Score y Statistics y
            calcula estos indicadores, sin cargar las bases operativas.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm text-muted">
            Temporada
            <select className="field" value={seasonId} onChange={(e) => setSeasonChoice(e.target.value)}>
              {seasons.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.leagueName} {x.year}
                </option>
              ))}
            </select>
          </label>
          <button
            className="btn btn-accent"
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
      </header>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      {summary.error && <Notice tone="error">{summary.error}</Notice>}

      {s && (
        <section aria-label="Indicadores de la liga" className="space-y-2">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Partidos programados" value={s.totalMatches} />
            <Stat label="Jugados" value={s.played} />
            <Stat label="En juego" value={s.live} />
            <Stat label="Suspendidos" value={s.suspended} />
            <Stat label="Asistencia total" value={s.totalAttendance.toLocaleString("es-CO")} />
            <Stat label="Asistencia promedio" value={s.averageAttendance.toLocaleString("es-CO")} />
          </div>
          <p className="text-xs text-muted">
            Toda la liga.{" "}
            {s.lastRun
              ? `Última corrida del ETL: ${RUN_LABEL[s.lastRun.status] ?? s.lastRun.status}` +
                (s.lastRun.finishedAt ? `, a las ${new Date(s.lastRun.finishedAt).toLocaleTimeString("es-CO")}` : "")
              : "El ETL aún no ha corrido."}
            {s.lastRun?.errors.length ? ` Réplicas sin responder: ${s.lastRun.errors.join("; ")}` : ""}
          </p>
        </section>
      )}

      <Section
        id="tendencia"
        title="Evolución del rendimiento"
        description="Puntos acumulados de cada equipo después de cada partido jugado en la temporada."
      >
        {series.length > 0 ? (
          <>
            <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label="Leyenda">
              {series.map((x) => (
                <li key={x.id} className="flex items-center gap-2">
                  <span aria-hidden className="h-0.5 w-4 rounded" style={{ background: x.color }} />
                  {x.label}
                </li>
              ))}
            </ul>
            <LineChart series={series} yLabel="Puntos acumulados" xLabel={(x) => `Después del partido ${x}`} />
            <p className="text-center text-xs text-muted">Partidos jugados</p>
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-muted">Ver como tabla</summary>
              <table className="mt-2 w-full text-left tabular-nums">
                <thead className="text-muted">
                  <tr>
                    <th className="py-1 pr-3 font-semibold">Equipo</th>
                    {Array.from({ length: Math.max(...series.map((x) => x.points.length)) }, (_, i) => (
                      <th key={i} className="py-1 pr-3 font-semibold">
                        P{i + 1}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {series.map((x) => (
                    <tr key={x.id} className="border-t border-line">
                      <td className="py-1 pr-3">{x.label}</td>
                      {x.points.map((p) => (
                        <td key={p.x} className="py-1 pr-3">
                          {p.y}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </>
        ) : (
          <p className="text-sm text-muted">Aparece cuando se finalizan partidos y corre el ETL.</p>
        )}
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section
          id="asistencia"
          title="Asistencia estimada por partido"
          description="Pico de espectadores que siguieron el marcador en vivo, por el factor de asistencia configurado."
        >
          {attendance.data && attendance.data.matches.length > 0 ? (
            <BarList
              unit="personas"
              rows={attendance.data.matches.map((m) => ({ id: m.matchId, label: matchLabel(m.matchId), value: m.estimatedAttendance }))}
            />
          ) : (
            <p className="text-sm text-muted">Sin datos: abre el marcador de un partido en vivo y ejecuta el ETL.</p>
          )}
        </Section>

        <Section id="suspendidos" title="Partidos suspendidos">
          {suspended.data && suspended.data.matches.length > 0 ? (
            <ul className="divide-y divide-line text-sm">
              {suspended.data.matches.map((m) => (
                <li key={m.matchId} className="py-2">
                  <span className="font-semibold">{matchLabel(m.matchId)}</span>
                  <span className="block text-muted">{m.reason}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Ningún partido suspendido en esta temporada.</p>
          )}
        </Section>
      </div>
    </main>
  );
}
