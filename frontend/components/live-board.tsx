"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import Crest from "@/components/crest";
import Tabs from "@/components/tabs";
import { API_URL, utcDate, utcDay } from "@/lib/services";
import { api, useSession } from "@/lib/session";
import type { Assignment, EventType, LiveMatch, Match, MatchEvent, Team } from "@/lib/types";

const EVENT_LABEL: Record<EventType, string> = {
  gol: "Gol",
  tarjeta_amarilla: "Tarjeta amarilla",
  tarjeta_roja: "Tarjeta roja",
  sustitucion: "Cambio",
};
const EVENT_TYPES = Object.keys(EVENT_LABEL) as EventType[];

function EventIcon({ type }: { type: EventType }) {
  if (type === "tarjeta_amarilla") return <span aria-hidden className="inline-block h-4 w-3 shrink-0 rounded-sm bg-yellow-400" />;
  if (type === "tarjeta_roja") return <span aria-hidden className="inline-block h-4 w-3 shrink-0 rounded-sm bg-red-500" />;
  if (type === "sustitucion")
    return (
      <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4 shrink-0">
        <path d="M6 3v10M6 13l-3-3M6 13l3-3" stroke="#6cc38a" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M14 17V7M14 7l-3 3M14 7l3 3" stroke="#e06a5a" strokeWidth="2" fill="none" strokeLinecap="round" />
      </svg>
    );
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4 shrink-0">
      <circle cx="10" cy="10" r="8.5" fill="#eaf2ec" />
      <path d="M10 5.5l3.2 2.3-1.2 3.8H8l-1.2-3.8z" fill="#0e1a14" />
      <path d="M10 1.5v4M13.2 7.8l3.9-1.4M12 11.6l2.4 3.5M8 11.6l-2.4 3.5M6.8 7.8 2.9 6.4" stroke="#0e1a14" strokeWidth="1.2" />
    </svg>
  );
}

interface Props {
  match: Match;
  home: Team;
  away: Team;
  initial: LiveMatch | null;
  competition: { seasonId: number; name: string; jornada: number | null };
  table: React.ReactNode;
}

export default function LiveBoard({ match, home, away, initial, competition, table }: Props) {
  const [live, setLive] = useState<LiveMatch | null>(initial);
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState("");
  const { user } = useSession();
  const [assigned, setAssigned] = useState(false);

  const teamOf = (id: number) => (id === home.id ? home : away);
  const playerName = (e: Pick<MatchEvent, "teamId" | "playerId">) => {
    if (!e.playerId) return "";
    const p = teamOf(e.teamId).players?.find((x) => x.id === e.playerId);
    return p ? (p.name ?? `Camiseta ${p.jerseyNumber}`) : `Jugador ${e.playerId}`;
  };

  // Marcador en vivo por WebSocket (canal /live-scores, a traves del API Gateway): sin polling
  useEffect(() => {
    const socket = io(`${API_URL}/live-scores`, { transports: ["websocket"] });
    socket.on("connect", () => {
      setConnected(true);
      socket.emit("subscribe", { matchId: match.id });
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on("snapshot", (data: LiveMatch) => setLive(data));
    socket.on("update", ({ type, live: next }: { type: string; live: LiveMatch }) => {
      setLive(next);
      if (type === "match.event") {
        const last = [...next.events].sort((a, b) => b.id - a.id)[0];
        if (last) setLastUpdate(`${EVENT_LABEL[last.type]} de ${teamOf(last.teamId).name}, minuto ${last.minute}`);
      } else if (type === "match.completed") setLastUpdate("Final del partido");
      else if (type === "match.suspended") setLastUpdate("Partido suspendido");
      else if (type === "match.event_annulled") setLastUpdate("Se anuló un evento");
    });
    return () => {
      socket.disconnect();
    };
    // teamOf solo depende de props estables del partido
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.id]);

  // Un arbitro solo controla los partidos que tiene asignados (el gateway tambien lo exige)
  const refereeId = user?.role === "arbitro" ? user.refereeId : null;
  useEffect(() => {
    if (!refereeId) return;
    let cancelled = false;
    api<Assignment[]>("GET", `/referees/${refereeId}/assignments`)
      .then((list) => {
        if (!cancelled) setAssigned(list.some((a) => a.matchId === match.id));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [refereeId, match.id]);

  const canControl = user?.role === "organizador" || (refereeId !== null && assigned);
  const status = live?.status ?? match.status;
  const score = live?.score ?? { home: 0, away: 0 };
  const events = [...(live?.events ?? [])].sort((a, b) => a.minute - b.minute || a.id - b.id);
  const lastMinute = events.at(-1)?.minute;
  const date = utcDate(match.scheduledAt);
  const showScore = status !== "programado" || events.length > 0;

  const statusLine = {
    en_curso: (
      <span className="flex items-center justify-center gap-2 font-semibold text-live">
        <span aria-hidden className="live-dot h-2 w-2 rounded-full bg-live" />
        En vivo{lastMinute !== undefined ? ` · ${lastMinute}'` : ""}
      </span>
    ),
    finalizado: <span className="font-semibold text-muted">Final</span>,
    suspendido: <span className="font-semibold text-async">Suspendido</span>,
    programado: (
      <span className="font-semibold capitalize text-muted">
        {utcDay(date)} {date.slice(8, 10)}/{date.slice(5, 7)}
      </span>
    ),
  }[status];

  const teamHeader = (t: Team) => (
    <div className="flex min-w-0 flex-col items-center gap-2 text-center">
      <Crest name={t.name} size={64} />
      <span className="font-display text-lg font-bold leading-tight sm:text-2xl">{t.name}</span>
    </div>
  );

  return (
    <div className="space-y-4">
      <Link href={`/temporadas/${competition.seasonId}`} className="text-sm text-sync hover:underline">
        ‹ {competition.name}
        {competition.jornada ? ` · Jornada ${competition.jornada}` : ""}
      </Link>

      {/* Marcador */}
      <section aria-label="Marcador" className="rounded-xl border border-line bg-surface px-4 pb-4 pt-5 sm:px-8">
        <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3">
          {teamHeader(home)}
          <div className="flex min-w-[7rem] flex-col items-center pt-3">
            <p
              className={`font-display text-5xl font-bold tabular-nums sm:text-6xl ${status === "en_curso" ? "text-live" : ""}`}
              aria-live="polite"
            >
              {showScore ? (
                <>
                  {score.home}
                  <span className="mx-2 text-muted">-</span>
                  {score.away}
                </>
              ) : (
                <span className="text-4xl text-muted">vs</span>
              )}
            </p>
            <div className="mt-1 text-sm">{statusLine}</div>
          </div>
          {teamHeader(away)}
        </div>
        {status === "suspendido" && live?.suspensionReason && (
          <p className="mt-3 text-center text-sm text-async">{live.suspensionReason}</p>
        )}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-line pt-3 text-xs text-muted">
          <span>{match.venue}</span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-ok" : "bg-error"}`} />
            {connected ? "Actualización en vivo" : "Reconectando..."}
          </span>
          {live?.viewers ? <span>{live.viewers} siguiendo el partido</span> : null}
        </div>
        <p className="min-h-5 pt-1 text-center text-sm text-sync" aria-live="polite">
          {lastUpdate}
        </p>
      </section>

      <div className={`grid gap-4 ${canControl ? "lg:grid-cols-[minmax(0,1fr)_23rem]" : ""}`}>
        {canControl && live && (
          <div className="lg:order-2">
            <div className="lg:sticky lg:top-4">
              <Controls match={match} home={home} away={away} live={live} onChange={setLive} />
            </div>
          </div>
        )}
        <div className="overflow-hidden rounded-lg border border-line bg-surface lg:order-1">
          <Tabs
            tabs={[
              {
                id: "resumen",
                label: "Resumen",
                content: (
                  <Timeline
                    events={events}
                    status={status}
                    homeId={home.id}
                    score={score}
                    playerName={playerName}
                    annul={canControl ? (eventId) => annul(match.id, eventId, setLive) : undefined}
                  />
                ),
              },
              { id: "plantillas", label: "Plantillas", content: <Lineups home={home} away={away} events={events} /> },
              { id: "tabla", label: "Tabla", content: table },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

async function annul(matchId: number, eventId: number, onDone: (l: LiveMatch) => void) {
  if (!window.confirm("¿Anular este evento? El marcador se corrige para todos los espectadores.")) return;
  try {
    await api("DELETE", `/matches/${matchId}/events/${eventId}`);
    onDone(await api<LiveMatch>("GET", `/matches/${matchId}/live`));
  } catch (err) {
    window.alert((err as Error).message);
  }
}

/**
 * Linea de tiempo como en las apps de resultados: el minuto al centro, los eventos
 * del local a la izquierda y los del visitante a la derecha, con el descanso y el final.
 */
function Timeline({
  events,
  status,
  homeId,
  score,
  playerName,
  annul,
}: {
  events: MatchEvent[];
  status: string;
  homeId: number;
  score: { home: number; away: number };
  playerName: (e: MatchEvent) => string;
  annul?: (eventId: number) => void;
}) {
  if (events.length === 0) {
    return <p className="p-6 text-center text-sm text-muted">Todavía no hay eventos en este partido.</p>;
  }
  let home = 0;
  let away = 0;
  const running = new Map<number, string>();
  for (const e of events) {
    if (e.type === "gol") {
      if (e.teamId === homeId) home++;
      else away++;
      running.set(e.id, `${home} - ${away}`);
    }
  }
  const firstHalf = events.filter((e) => e.minute <= 45);
  const secondHalf = events.filter((e) => e.minute > 45);
  const htGoals = firstHalf.filter((e) => e.type === "gol");
  const ht = `${htGoals.filter((e) => e.teamId === homeId).length} - ${htGoals.filter((e) => e.teamId !== homeId).length}`;
  const row = (e: MatchEvent) => (
    <TimelineRow
      key={e.id}
      event={e}
      isHome={e.teamId === homeId}
      player={playerName(e)}
      runningScore={running.get(e.id)}
      annul={annul}
    />
  );

  return (
    <ol className="px-4 py-3">
      {firstHalf.map(row)}
      {(secondHalf.length > 0 || status === "finalizado") && <TimelineDivider label="Descanso" value={ht} />}
      {secondHalf.map(row)}
      {status === "finalizado" && <TimelineDivider label="Final" value={`${score.home} - ${score.away}`} />}
    </ol>
  );
}

function TimelineDivider({ label, value }: { label: string; value: string }) {
  return (
    <li className="my-2 flex items-center justify-center gap-2 rounded-md bg-surface-2 py-1.5 text-xs font-semibold text-muted">
      {label} <span className="tabular-nums text-ink">{value}</span>
    </li>
  );
}

function TimelineRow({
  event: e,
  isHome,
  player,
  runningScore,
  annul,
}: {
  event: MatchEvent;
  isHome: boolean;
  player: string;
  runningScore?: string;
  annul?: (eventId: number) => void;
}) {
  const detail = (
    <span className={`flex min-w-0 items-center gap-2 ${isHome ? "flex-row-reverse text-right" : ""}`}>
      <EventIcon type={e.type} />
      <span className="min-w-0 break-words leading-tight">
        <span className="font-semibold">{player || EVENT_LABEL[e.type]}</span>
        {player && <span className="sr-only"> ({EVENT_LABEL[e.type]})</span>}
        {runningScore && <span className="ml-1.5 whitespace-nowrap tabular-nums text-sync">{runningScore}</span>}
      </span>
      {annul && (
        <button
          className="shrink-0 rounded px-1 text-xs text-muted hover:bg-error/20 hover:text-error"
          title="Anular este evento"
          aria-label={`Anular ${EVENT_LABEL[e.type]} del minuto ${e.minute}`}
          onClick={() => annul(e.id)}
        >
          ✕
        </button>
      )}
    </span>
  );
  return (
    <li className="grid grid-cols-[1fr_2.75rem_1fr] items-center gap-1.5 py-1.5 text-sm sm:gap-2">
      <span className="flex min-w-0 justify-end">{isHome && detail}</span>
      <span className="mx-auto rounded-full border border-line px-2 py-0.5 text-xs font-semibold tabular-nums">
        {e.minute}&apos;
      </span>
      <span className="min-w-0">{!isHome && detail}</span>
    </li>
  );
}

/** Plantillas de los dos equipos, con los goles y tarjetas del partido. */
function Lineups({ home, away, events }: { home: Team; away: Team; events: MatchEvent[] }) {
  const column = (t: Team) => (
    <div className="min-w-0">
      <h3 className="flex items-center gap-2 border-b border-line px-4 py-2.5 text-sm font-semibold">
        <Crest name={t.name} size={20} /> {t.name}
      </h3>
      {(t.players ?? []).length === 0 ? (
        <p className="px-4 py-3 text-sm text-muted">Sin jugadores registrados.</p>
      ) : (
        <ul className="divide-y divide-line">
          {[...(t.players ?? [])]
            .sort((a, b) => a.jerseyNumber - b.jerseyNumber)
            .map((p) => {
              const mine = events.filter((e) => e.playerId === p.id);
              return (
                <li key={p.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-bold tabular-nums">
                    {p.jerseyNumber}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{p.name ?? `Camiseta ${p.jerseyNumber}`}</span>
                  <span className="flex items-center gap-1">
                    {mine.map((e) => (
                      <EventIcon key={e.id} type={e.type} />
                    ))}
                  </span>
                </li>
              );
            })}
        </ul>
      )}
    </div>
  );
  return (
    <div className="grid sm:grid-cols-2 sm:divide-x sm:divide-line">
      {column(home)}
      {column(away)}
    </div>
  );
}

/** Panel del arbitro asignado o del organizador para registrar el partido. */
function Controls({
  match,
  home,
  away,
  live,
  onChange,
}: {
  match: Match;
  home: Team;
  away: Team;
  live: LiveMatch;
  onChange: (l: LiveMatch) => void;
}) {
  const [type, setType] = useState<EventType>("gol");
  const [teamId, setTeamId] = useState(home.id);
  const [playerId, setPlayerId] = useState("");
  const [minute, setMinute] = useState(() => String(live.events.at(-1)?.minute ?? 1));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const team = teamId === home.id ? home : away;
  const finished = live.status === "finalizado";

  async function run(action: () => Promise<string>) {
    setBusy(true);
    setMessage(null);
    try {
      const text = await action();
      onChange(await api<LiveMatch>("GET", `/matches/${match.id}/live`));
      setMessage({ tone: "ok", text });
    } catch (err) {
      setMessage({ tone: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  if (live.status === "suspendido") {
    return (
      <section className="rounded-lg border border-line bg-surface p-5 text-sm text-muted">
        El partido está suspendido: no admite más eventos.
      </section>
    );
  }

  return (
    <section aria-labelledby="controles" className="rounded-lg border border-async/50 bg-surface p-4">
      <h2 id="controles" className="font-display text-xl font-bold">
        {finished ? "Corregir el acta" : "Mesa de control"}
      </h2>
      <p className="mt-0.5 text-xs text-muted">
        {finished
          ? "Cada cambio reenvía el acta y la tabla se recalcula sin duplicar."
          : "Cada evento actualiza el marcador de todos los espectadores al instante."}
      </p>

      <form
        className="mt-3 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            await api("POST", `/matches/${match.id}/events`, {
              type,
              minute: Number(minute),
              teamId,
              ...(playerId ? { playerId: Number(playerId) } : {}),
            });
            return `${EVENT_LABEL[type]} registrado para ${team.name}.`;
          });
        }}
      >
        <fieldset>
          <legend className="sr-only">Equipo</legend>
          <div className="grid grid-cols-2 gap-2">
            {[home, away].map((t) => (
              <label
                key={t.id}
                className={`flex cursor-pointer items-center justify-center gap-2 rounded-md border px-2 py-2 text-sm font-semibold ${teamId === t.id ? "border-sync bg-sync/10" : "border-line"}`}
              >
                <input
                  type="radio"
                  name="team"
                  checked={teamId === t.id}
                  onChange={() => {
                    setTeamId(t.id);
                    setPlayerId("");
                  }}
                  className="sr-only"
                />
                <Crest name={t.name} size={18} />
                <span className="truncate">{t.name}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="sr-only">Evento</legend>
          <div className="grid grid-cols-2 gap-2">
            {EVENT_TYPES.map((t) => (
              <label
                key={t}
                className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${type === t ? "border-sync bg-sync/10" : "border-line"}`}
              >
                <input type="radio" name="type" value={t} checked={type === t} onChange={() => setType(t)} className="sr-only" />
                <EventIcon type={t} /> {EVENT_LABEL[t]}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-[2fr_1fr] gap-2">
          <label className="block text-xs text-muted">
            Jugador
            <select className="field" value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
              <option value="">Sin especificar</option>
              {(team.players ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.jerseyNumber}. {p.name ?? `Camiseta ${p.jerseyNumber}`}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-muted">
            Minuto
            <input
              className="field tabular-nums"
              type="number"
              min={0}
              max={130}
              required
              value={minute}
              onChange={(e) => setMinute(e.target.value)}
            />
          </label>
        </div>

        <button type="submit" className="btn btn-primary w-full justify-center" disabled={busy}>
          {finished ? "Agregar al acta" : "Registrar"}
        </button>
      </form>

      <div className="mt-4 space-y-2 border-t border-line pt-3">
        <button
          className="btn btn-accent w-full justify-center"
          disabled={busy}
          onClick={() => {
            if (!finished && !window.confirm("¿Finalizar el partido? Se publica el acta y se recalcula la tabla.")) return;
            run(async () => {
              const acta = await api<{ homeGoals: number; awayGoals: number; resent: boolean }>(
                "POST",
                `/matches/${match.id}/complete`,
              );
              return acta.resent
                ? "Acta reenviada: las estadísticas se recalculan con ella."
                : `Partido finalizado ${acta.homeGoals} - ${acta.awayGoals}. La tabla de posiciones se actualiza sola.`;
            });
          }}
        >
          {finished ? "Reenviar acta" : "Finalizar partido"}
        </button>

        {!finished && (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                await api("POST", `/matches/${match.id}/suspend`, { reason });
                return "Partido suspendido. Se avisó a los equipos.";
              });
            }}
          >
            <label className="sr-only" htmlFor="reason">
              Motivo de la suspensión
            </label>
            <input
              id="reason"
              className="field mt-0 flex-1 text-sm"
              placeholder="Motivo de suspensión"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <button type="submit" className="btn btn-danger btn-sm" disabled={busy}>
              Suspender
            </button>
          </form>
        )}
      </div>

      {message && (
        <p role="status" className={`mt-3 text-sm ${message.tone === "ok" ? "text-ok" : "text-error"}`}>
          {message.text}
        </p>
      )}
    </section>
  );
}
