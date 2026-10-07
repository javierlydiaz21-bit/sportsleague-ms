"use client";

/*
 * 5. Partidos y actas, detalle (diseño: viewPartidos con id, ruta #/partidos/{id}). Por el API Gateway:
 *   Live Score Service .. GET    /matches/{id}/live                 marcador y eventos (y WebSocket /live-scores)
 *                         POST   /matches/{id}/events               registrar evento; si el partido terminó, corrige el acta
 *                         DELETE /matches/{id}/events/{eventId}     anular evento (también reenvía el acta)
 *                         POST   /matches/{id}/complete             finalizar (match.completed)
 *                         POST   /matches/{id}/suspend              suspender (match.suspended)
 *   Referee Service ..... GET    /referees/{id}/assignments         el árbitro solo controla sus partidos
 * Corregir un evento del acta = registrar el evento corregido y anular el anterior: el Live Score
 * Service reenvía match.completed y el Statistics Service recalcula sin duplicar.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import Crest from "@/components/crest";
import { Band, Field, FormMessage, Page, StatusChip } from "@/components/ui";
import { API_URL, longDate } from "@/lib/services";
import { api, useSession } from "@/lib/session";
import type { Assignment, EventType, LiveMatch, Match, MatchEvent, Team } from "@/lib/types";

// Etiquetas y clases del diseño (EVENT y .ev-*)
const EVENT_LABEL: Record<EventType, string> = {
  gol: "Gol",
  tarjeta_amarilla: "Tarjeta amarilla",
  tarjeta_roja: "Tarjeta roja",
  sustitucion: "Sustitución",
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
  jornada: number | null;
}

export default function MatchDetail({ match, home, away, initial, jornada }: Props) {
  const [live, setLive] = useState<LiveMatch | null>(initial);
  const [announce, setAnnounce] = useState("");
  const { user } = useSession();
  const [assigned, setAssigned] = useState(false);
  const teamOf = (id: number) => (id === home.id ? home : away);

  // Marcador en vivo por WebSocket (canal /live-scores, a través del API Gateway): sin polling
  useEffect(() => {
    const socket = io(`${API_URL}/live-scores`, { transports: ["websocket"] });
    socket.on("connect", () => socket.emit("subscribe", { matchId: match.id }));
    socket.on("snapshot", (data: LiveMatch) => setLive(data));
    socket.on("update", ({ type, live: next }: { type: string; live: LiveMatch }) => {
      setLive(next);
      if (type === "match.event") {
        const last = [...next.events].sort((a, b) => b.id - a.id)[0];
        if (last?.type === "gol") setAnnounce(`Gol de ${teamOf(last.teamId).name}, minuto ${last.minute}.`);
      } else if (type === "match.completed") setAnnounce("Final del partido. La tabla de posiciones se actualizó.");
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

  const organizer = user?.role === "organizador";
  const canControl = organizer || (refereeId !== null && assigned);
  const status = live?.status ?? match.status;
  const events = [...(live?.events ?? [])].sort((a, b) => a.minute - b.minute || a.id - b.id);
  const score = live?.score ?? { home: 0, away: 0 };
  const shows = status === "finalizado" || status === "en_curso";
  const minute = events.at(-1)?.minute;

  const content = (
    <>
      {organizer && (
        <p>
          <Link className="linkish" href="/partidos">
            Todos los partidos
          </Link>
        </p>
      )}
      <div className="board" aria-label="Marcador">
        <div className="board-top">
          <span>
            {jornada ? `Jornada ${jornada}, ` : ""}
            {longDate(match.scheduledAt)}, {match.venue}
          </span>
          <StatusChip status={status} />
        </div>
        <div className="board-score">
          <div className="board-side">
            <Crest name={home.name} id={home.id} size={64} />
            {home.name}
          </div>
          <div>
            <div className="board-digits">{shows ? `${score.home}–${score.away}` : "vs"}</div>
            {status === "en_curso" && <span className="board-clock">{minute ?? 0}&apos;</span>}
          </div>
          <div className="board-side">
            <Crest name={away.name} id={away.id} size={64} />
            {away.name}
          </div>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      {status === "en_curso" ? (
        <section className="card">
          <h2>Eventos del partido</h2>
          <p className="hint">El marcador cambia con cada evento. El acta se puede corregir cuando el partido termine.</p>
          <EventsList events={events} status={status} reason={live?.suspensionReason ?? null} home={home} away={away} />
        </section>
      ) : status === "finalizado" && organizer ? (
        <Acta match={match} home={home} away={away} events={events} onChange={setLive} />
      ) : (
        <section className="card">
          <h2>Eventos del partido</h2>
          <EventsList events={events} status={status} reason={live?.suspensionReason ?? null} home={home} away={away} />
        </section>
      )}

      {canControl && live && (status === "programado" || status === "en_curso") && (
        <Controls match={match} home={home} away={away} live={live} onChange={setLive} />
      )}
    </>
  );

  if (organizer) {
    return (
      <>
        <Band
          icon="partidos"
          title="Partidos y actas"
          intro="Sigue los partidos en curso y corrige el acta de los que ya terminaron. Los eventos los registra el árbitro desde su app."
        />
        <Page>{content}</Page>
      </>
    );
  }
  return <Page>{content}</Page>;
}

const jerseyOf = (team: Team, playerId: number | null) => (playerId ? team.players?.find((p) => p.id === playerId)?.jerseyNumber : undefined);

/** Texto de cada evento, como en el diseño. */
function eventText(e: MatchEvent, home: Team, away: Team) {
  const team = e.teamId === home.id ? home : away;
  const j = jerseyOf(team, e.playerId);
  const t = team.name;
  switch (e.type) {
    case "gol":
      return `Gol de ${t}${j ? `, #${j}` : ""}`;
    case "tarjeta_amarilla":
      return j ? `Amarilla para el #${j} de ${t}` : `Amarilla para ${t}`;
    case "tarjeta_roja":
      return j ? `Roja para el #${j} de ${t}` : `Roja para ${t}`;
    default:
      return j ? `Cambio en ${t}: entra el #${j}` : `Cambio en ${t}`;
  }
}

function EventsList({
  events,
  status,
  reason,
  home,
  away,
}: {
  events: MatchEvent[];
  status: string;
  reason: string | null;
  home: Team;
  away: Team;
}) {
  if (status === "programado") return <p className="empty">El partido todavía no empieza.</p>;
  if (status === "suspendido") return <p className="empty">Partido suspendido{reason ? `: ${reason}` : ""}.</p>;
  if (!events.length) return <p className="empty">Sin eventos registrados.</p>;
  return (
    <ol className="events">
      {events.map((e) => (
        <li key={e.id}>
          <span className="min">{e.minute}&apos;</span>
          <EventIcon type={e.type} />
          <span>{eventText(e, home, away)}</span>
          <span />
        </li>
      ))}
    </ol>
  );
}

/** Acta del partido finalizado, con la corrección de cada evento. */
function Acta({
  match,
  home,
  away,
  events,
  onChange,
}: {
  match: Match;
  home: Team;
  away: Team;
  events: MatchEvent[];
  onChange: (l: LiveMatch) => void;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const [fixMsg, setFixMsg] = useState("");
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent<HTMLFormElement>, ev: MatchEvent) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const minute = Number(fd.get("minute"));
    const type = String(fd.get("type")) as EventType;
    const team = String(fd.get("side")) === "home" ? home : away;
    const j = Number(fd.get("jersey"));
    if (!(minute >= 1 && minute <= 120)) return setFixMsg("El minuto debe estar entre 1 y 120.");
    const p = team.players?.find((x) => x.jerseyNumber === j);
    if (!p) return setFixMsg(`${team.name} no tiene un jugador con la camiseta #${j}.`);
    setBusy(true);
    try {
      // Live Score Service: el evento corregido entra al acta y el anterior se anula (cada paso reenvía match.completed)
      await api("POST", `/matches/${match.id}/events`, { type, minute, teamId: team.id, playerId: p.id });
      await api("DELETE", `/matches/${match.id}/events/${ev.id}`);
      onChange(await api<LiveMatch>("GET", `/matches/${match.id}/live`));
      setEditing(null);
      setMsg({ tone: "ok", text: "Acta corregida. El marcador, la tabla, los goleadores y las tarjetas se recalcularon." });
    } catch (err) {
      setFixMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2>Acta del partido</h2>
      <p className="hint">Si un evento quedó mal registrado, corrígelo. El marcador, la tabla, los goleadores y las tarjetas se recalculan.</p>
      <FormMessage message={msg} />
      {events.length ? (
        <div className="scroll">
          <table className="data">
            <thead>
              <tr>
                <th className="num">Minuto</th>
                <th>Evento</th>
                <th>Equipo</th>
                <th>Camiseta</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {events.map((e) => {
                const team = e.teamId === home.id ? home : away;
                const j = jerseyOf(team, e.playerId);
                return editing === e.id ? (
                  <tr key={e.id}>
                    <td colSpan={5}>
                      <form className="inline-form" noValidate onSubmit={(f) => save(f, e)}>
                        <input type="number" name="minute" min={1} max={120} defaultValue={e.minute} aria-label="Minuto" style={{ width: 90 }} />
                        <select name="type" aria-label="Evento" defaultValue={e.type}>
                          {EVENT_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {EVENT_LABEL[t]}
                            </option>
                          ))}
                        </select>
                        <select name="side" aria-label="Equipo" defaultValue={e.teamId === home.id ? "home" : "away"}>
                          <option value="home">{home.name}</option>
                          <option value="away">{away.name}</option>
                        </select>
                        <input type="number" name="jersey" min={1} defaultValue={j} aria-label="Camiseta" style={{ width: 90 }} />
                        <button className="btn btn-blue btn-sm" type="submit" disabled={busy}>
                          Guardar corrección
                        </button>
                        <button className="btn btn-sm" type="button" onClick={() => setEditing(null)}>
                          Cancelar
                        </button>
                        {fixMsg && (
                          <p className="form-msg is-error" role="alert">
                            {fixMsg}
                          </p>
                        )}
                      </form>
                    </td>
                  </tr>
                ) : (
                  <tr key={e.id}>
                    <td className="num pos">{e.minute}&apos;</td>
                    <td>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <EventIcon type={e.type} />
                        {EVENT_LABEL[e.type]}
                      </span>
                    </td>
                    <td>{team.name}</td>
                    <td>{j ? `#${j}` : "—"}</td>
                    <td>
                      <button
                        className="linkish"
                        type="button"
                        onClick={() => {
                          setFixMsg("");
                          setMsg(null);
                          setEditing(e.id);
                        }}
                      >
                        Corregir
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty">El acta no tiene eventos.</p>
      )}
    </section>
  );
}

/** Mesa de control (fuera del diseño): el árbitro asignado o el organizador registran el partido. */
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

  return (
    <section aria-labelledby="controles" className="card controls">
      <div className="head">
        <div>
          <h2 id="controles">Mesa de control</h2>
          <p className="hint">Cada evento actualiza el marcador de todos los espectadores al instante.</p>
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
              <Crest name={t.name} id={t.id} size={22} />
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
                  #{p.jerseyNumber}
                  {p.name ? ` ${p.name}` : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Minuto">
            <input type="number" min={0} max={130} required value={minute} onChange={(e) => setMinute(e.target.value)} />
          </Field>
        </div>
        <button type="submit" className="btn btn-blue btn-block mt-4" disabled={busy}>
          Registrar evento
        </button>
      </form>
      <div className="f grid gap-3">
        <button
          type="button"
          className="btn btn-green btn-block"
          disabled={busy}
          onClick={() => {
            if (!window.confirm("¿Finalizar el partido? Se publica el acta y se recalcula la tabla.")) return;
            run(async () => {
              const acta = await api<{ homeGoals: number; awayGoals: number }>("POST", `/matches/${match.id}/complete`);
              return `Partido finalizado ${acta.homeGoals}–${acta.awayGoals}. La tabla de posiciones se actualiza sola.`;
            });
          }}
        >
          Finalizar partido
        </button>
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
          <input id="reason" className="flex-1" placeholder="Motivo de la suspensión" required value={reason} onChange={(e) => setReason(e.target.value)} />
          <button type="submit" className="btn btn-red" disabled={busy}>
            Suspender
          </button>
        </form>
      </div>
      <FormMessage message={message} />
    </section>
  );
}
