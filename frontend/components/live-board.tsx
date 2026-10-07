"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import Crest from "@/components/crest";
import { Pitch } from "@/components/icons";
import Tabs from "@/components/tabs";
import { Field, FormMessage, StatusChip } from "@/components/ui";
import { API_URL, longDate } from "@/lib/services";
import { api, useSession } from "@/lib/session";
import type { Assignment, EventType, LiveMatch, Match, MatchEvent, Team } from "@/lib/types";

const EVENT_LABEL: Record<EventType, string> = {
  gol: "Gol",
  tarjeta_amarilla: "Tarjeta amarilla",
  tarjeta_roja: "Tarjeta roja",
  sustitucion: "Cambio",
};
const EVENT_CLASS: Record<EventType, string> = {
  gol: "ev-gol",
  tarjeta_amarilla: "ev-amarilla",
  tarjeta_roja: "ev-roja",
  sustitucion: "ev-sustitucion",
};
const EVENT_TYPES = Object.keys(EVENT_LABEL) as EventType[];

function EventIcon({ type }: { type: EventType }) {
  return <span aria-hidden className={`ev ${EVENT_CLASS[type]}`} />;
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
    return p ? `${p.name ?? "Camiseta"} #${p.jerseyNumber}` : `Jugador ${e.playerId}`;
  };

  // Marcador en vivo por WebSocket (canal /live-scores, a través del API Gateway): sin polling
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
      } else if (type === "match.completed") setLastUpdate("Final del partido. La tabla de posiciones se actualizó.");
      else if (type === "match.suspended") setLastUpdate("Partido suspendido");
      else if (type === "match.event_annulled") setLastUpdate("Se anuló un evento");
    });
    return () => {
      socket.disconnect();
    };
    // teamOf solo depende de props estables del partido
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.id]);

  // Un árbitro solo controla los partidos que tiene asignados (el gateway también lo exige)
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
  const showScore = status !== "programado" || events.length > 0;

  return (
    <>
      <section aria-label="Marcador" className="board">
        <Pitch />
        <div className="board-top">
          <span>
            <Link href={`/temporadas/${competition.seasonId}`}>{competition.name}</Link>
            {competition.jornada ? `, jornada ${competition.jornada}` : ""}, {longDate(match.scheduledAt)}
          </span>
          <StatusChip status={status} />
        </div>
        <div className="board-score">
          <div className="board-side">
            <Crest name={home.name} size={64} />
            {home.name}
          </div>
          <div>
            <div className={`board-digits${showScore ? "" : " vs"}`} aria-live="polite">
              {showScore ? `${score.home}–${score.away}` : "vs"}
            </div>
            {status === "en_curso" && lastMinute !== undefined && <span className="board-clock">{lastMinute}&apos;</span>}
          </div>
          <div className="board-side">
            <Crest name={away.name} size={64} />
            {away.name}
          </div>
        </div>
        {status === "suspendido" && live?.suspensionReason && <p className="board-note">{live.suspensionReason}</p>}
        <div className="board-meta">
          <span>{match.venue}</span>
          <span>
            <span aria-hidden className={`dot${connected ? "" : " off"}`} />
            {connected ? "Actualización en vivo" : "Reconectando..."}
          </span>
          {live?.viewers ? <span>{live.viewers} siguiendo el partido</span> : null}
        </div>
        <p className="board-flash" aria-live="polite">
          {lastUpdate}
        </p>
      </section>

      <div className={canControl ? "cols" : undefined}>
        <section className="card tabs-card" aria-label="Detalle del partido">
          <Tabs
            label="Detalle del partido"
            tabs={[
              {
                id: "eventos",
                label: "Eventos",
                content: (
                  <Timeline
                    events={events}
                    status={status}
                    home={home}
                    away={away}
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
        </section>
        {canControl && live && <Controls match={match} home={home} away={away} live={live} onChange={setLive} />}
      </div>
    </>
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

/** Eventos en orden: minuto, ícono y texto, con el marcador parcial en cada gol, el descanso y el final. */
function Timeline({
  events,
  status,
  home,
  away,
  score,
  playerName,
  annul,
}: {
  events: MatchEvent[];
  status: string;
  home: Team;
  away: Team;
  score: { home: number; away: number };
  playerName: (e: MatchEvent) => string;
  annul?: (eventId: number) => void;
}) {
  if (status === "programado" && events.length === 0) return <p className="empty">El partido todavía no empieza.</p>;
  if (events.length === 0) return <p className="empty">Todavía no hay eventos en este partido.</p>;
  let h = 0;
  let a = 0;
  const running = new Map<number, string>();
  for (const e of events) {
    if (e.type === "gol") {
      if (e.teamId === home.id) h++;
      else a++;
      running.set(e.id, `${h}–${a}`);
    }
  }
  const firstHalf = events.filter((e) => e.minute <= 45);
  const secondHalf = events.filter((e) => e.minute > 45);
  const htGoals = firstHalf.filter((e) => e.type === "gol");
  const ht = `${htGoals.filter((e) => e.teamId === home.id).length}–${htGoals.filter((e) => e.teamId !== home.id).length}`;
  const row = (e: MatchEvent) => {
    const team = e.teamId === home.id ? home : away;
    const player = playerName(e);
    return (
      <li key={e.id}>
        <span className="min">{e.minute}&apos;</span>
        <EventIcon type={e.type} />
        <span>
          <b>{EVENT_LABEL[e.type]}</b> de {team.name}
          {player && `, ${player}`}
          {running.has(e.id) && <span className="ev-score">{running.get(e.id)}</span>}
        </span>
        {annul ? (
          <button
            type="button"
            className="annul"
            aria-label={`Anular ${EVENT_LABEL[e.type]} del minuto ${e.minute}`}
            onClick={() => annul(e.id)}
          >
            Anular
          </button>
        ) : (
          <span />
        )}
      </li>
    );
  };

  return (
    <ol className="events">
      {firstHalf.map(row)}
      {(secondHalf.length > 0 || status === "finalizado") && (
        <li className="ev-divider">
          Descanso <b>{ht}</b>
        </li>
      )}
      {secondHalf.map(row)}
      {status === "finalizado" && (
        <li className="ev-divider">
          Final <b>{`${score.home}–${score.away}`}</b>
        </li>
      )}
    </ol>
  );
}

/** Plantillas de los dos equipos, con los goles y tarjetas del partido. */
function Lineups({ home, away, events }: { home: Team; away: Team; events: MatchEvent[] }) {
  const column = (t: Team) => (
    <div className="min-w-0">
      <h3>
        <Crest name={t.name} size={28} /> {t.name}
      </h3>
      {(t.players ?? []).length === 0 ? (
        <p className="empty">Sin jugadores registrados.</p>
      ) : (
        <ul>
          {[...(t.players ?? [])]
            .sort((a, b) => a.jerseyNumber - b.jerseyNumber)
            .map((p) => (
              <li key={p.id}>
                <span className="jersey">{p.jerseyNumber}</span>
                <span className="truncate">{p.name ?? `Camiseta ${p.jerseyNumber}`}</span>
                <span>
                  {events
                    .filter((e) => e.playerId === p.id)
                    .map((e) => (
                      <EventIcon key={e.id} type={e.type} />
                    ))}
                </span>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
  return (
    <div className="lineups">
      {column(home)}
      {column(away)}
    </div>
  );
}

/** Mesa de control del árbitro asignado o del organizador para registrar el partido. */
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
      <section className="card controls">
        <h2>Mesa de control</h2>
        <p className="hint">El partido está suspendido: no admite más eventos.</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="controles" className="card controls">
      <div className="head">
        <div>
          <h2 id="controles">{finished ? "Corregir el acta" : "Mesa de control"}</h2>
          <p className="hint">
            {finished
              ? "Cada cambio reenvía el acta y la tabla se recalcula sin duplicar."
              : "Cada evento actualiza el marcador de todos los espectadores al instante."}
          </p>
        </div>
      </div>

      <form
        className="mt-5"
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
        <fieldset className="opts">
          <legend className="sr-only">Equipo</legend>
          {[home, away].map((t) => (
            <label key={t.id} className="opt">
              <input
                type="radio"
                name="team"
                className="sr-only"
                checked={teamId === t.id}
                onChange={() => {
                  setTeamId(t.id);
                  setPlayerId("");
                }}
              />
              <Crest name={t.name} size={22} />
              <span>{t.name}</span>
            </label>
          ))}
        </fieldset>
        <fieldset className="opts">
          <legend className="sr-only">Evento</legend>
          {EVENT_TYPES.map((t) => (
            <label key={t} className="opt">
              <input type="radio" name="type" value={t} className="sr-only" checked={type === t} onChange={() => setType(t)} />
              <EventIcon type={t} />
              <span>{EVENT_LABEL[t]}</span>
            </label>
          ))}
        </fieldset>
        <div className="grid grid-cols-[2fr_1fr] gap-3">
          <Field label="Jugador">
            <select value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
              <option value="">Sin especificar</option>
              {(team.players ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.jerseyNumber}. {p.name ?? `Camiseta ${p.jerseyNumber}`}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Minuto">
            <input type="number" min={0} max={130} required value={minute} onChange={(e) => setMinute(e.target.value)} />
          </Field>
        </div>
        <button type="submit" className="btn btn-blue btn-block mt-4" disabled={busy}>
          {finished ? "Agregar al acta" : "Registrar evento"}
        </button>
      </form>

      <div className="f grid gap-3">
        <button
          type="button"
          className="btn btn-green btn-block"
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
                : `Partido finalizado ${acta.homeGoals}–${acta.awayGoals}. La tabla de posiciones se actualiza sola.`;
            });
          }}
        >
          {finished ? "Reenviar acta" : "Finalizar partido"}
        </button>

        {!finished && (
          <form
            className="inline-form"
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
              className="flex-1"
              placeholder="Motivo de la suspensión"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <button type="submit" className="btn btn-red" disabled={busy}>
              Suspender
            </button>
          </form>
        )}
      </div>
      <FormMessage message={message} />
    </section>
  );
}
