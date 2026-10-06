"use client";

import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { StatusBadge } from "@/components/ui";
import { API_URL } from "@/lib/services";
import { api, useSession } from "@/lib/session";
import type { Assignment, EventType, LiveMatch, Match, MatchEvent, Team } from "@/lib/types";

const EVENT_LABEL: Record<EventType, string> = {
  gol: "Gol",
  tarjeta_amarilla: "Tarjeta amarilla",
  tarjeta_roja: "Tarjeta roja",
  sustitucion: "Sustitución",
};
const EVENT_TYPES = Object.keys(EVENT_LABEL) as EventType[];

function EventIcon({ type }: { type: EventType }) {
  if (type === "tarjeta_amarilla") return <span aria-hidden className="inline-block h-4 w-3 rounded-sm bg-yellow-400" />;
  if (type === "tarjeta_roja") return <span aria-hidden className="inline-block h-4 w-3 rounded-sm bg-red-500" />;
  if (type === "sustitucion") return <span aria-hidden className="font-bold text-sync">⇄</span>;
  return <span aria-hidden className="rounded bg-ok/20 px-1 text-xs font-bold text-ok">GOL</span>;
}

interface Props {
  match: Match;
  home: Team;
  away: Team;
  initial: LiveMatch | null;
}

export default function LiveBoard({ match, home, away, initial }: Props) {
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
        if (last) {
          setLastUpdate(`${EVENT_LABEL[last.type]} de ${teamOf(last.teamId).name}, minuto ${last.minute}`);
        }
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
  const events = live?.events ?? [];

  return (
    <div className="space-y-6">
      <section aria-label="Marcador" className="rounded-xl border border-line bg-surface p-5 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <StatusBadge status={status} />
          <span className="flex items-center gap-2 text-muted">
            <span aria-hidden className={`h-2 w-2 rounded-full ${connected ? "bg-ok" : "bg-error"}`} />
            {connected ? "Conectado en vivo" : "Reconectando..."}
            {live?.viewers ? ` · ${live.viewers} espectador${live.viewers === 1 ? "" : "es"}` : ""}
          </span>
        </div>
        <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <h1 className="text-right font-display text-2xl font-bold sm:text-4xl">{home.name}</h1>
          <p className="font-display text-5xl font-bold tabular-nums sm:text-7xl" aria-live="polite">
            {score.home}
            <span className="mx-2 text-muted">-</span>
            {score.away}
          </p>
          <p className="font-display text-2xl font-bold sm:text-4xl">{away.name}</p>
        </div>
        {status === "suspendido" && live?.suspensionReason && (
          <p className="mt-4 text-center text-async">Suspendido: {live.suspensionReason}</p>
        )}
        <p className="mt-4 min-h-6 text-center text-sm text-sync" aria-live="polite">
          {lastUpdate}
        </p>
      </section>

      <div className={`grid gap-6 ${canControl ? "lg:grid-cols-[3fr_2fr]" : ""}`}>
        <section aria-labelledby="timeline" className="rounded-lg border border-line bg-surface p-5">
          <h2 id="timeline" className="font-display text-2xl font-bold">
            Línea de tiempo
          </h2>
          {events.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Todavía no hay eventos registrados.</p>
          ) : (
            <ol className="mt-3 space-y-2">
              {events.map((e) => {
                const isHome = e.teamId === home.id;
                return (
                  <li
                    key={e.id}
                    className={`flex items-center gap-3 rounded-md bg-surface-2 px-3 py-2 text-sm ${isHome ? "" : "flex-row-reverse text-right"}`}
                  >
                    <span className="w-10 font-display text-lg font-bold tabular-nums text-muted">{e.minute}&apos;</span>
                    <EventIcon type={e.type} />
                    <span className="flex-1">
                      <span className="font-semibold">{EVENT_LABEL[e.type]}</span>{" "}
                      <span className="text-muted">
                        {playerName(e) && `${playerName(e)} · `}
                        {teamOf(e.teamId).name}
                      </span>
                    </span>
                    {canControl && <AnnulButton matchId={match.id} eventId={e.id} onDone={setLive} />}
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {canControl && live && (
          <Controls match={match} home={home} away={away} live={live} onChange={setLive} />
        )}
      </div>
    </div>
  );
}

function AnnulButton({ matchId, eventId, onDone }: { matchId: number; eventId: number; onDone: (l: LiveMatch) => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn btn-ghost btn-sm"
      disabled={busy}
      title="Anular este evento"
      onClick={async () => {
        if (!window.confirm("¿Anular este evento? El marcador se corrige para todos los espectadores.")) return;
        setBusy(true);
        try {
          await api("DELETE", `/matches/${matchId}/events/${eventId}`);
          onDone(await api<LiveMatch>("GET", `/matches/${matchId}/live`));
        } catch (err) {
          window.alert((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      Anular
    </button>
  );
}

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
    <section aria-labelledby="controles" className="rounded-lg border border-async/50 bg-surface p-5">
      <h2 id="controles" className="font-display text-2xl font-bold">
        {finished ? "Corregir el acta" : "Registrar evento"}
      </h2>
      <p className="mt-1 text-sm text-muted">
        {finished
          ? "El partido ya terminó. Cada cambio reenvía el acta y la tabla de posiciones se recalcula sin duplicar."
          : "Cada evento actualiza el marcador de todos los espectadores al instante."}
      </p>

      <form
        className="mt-4 space-y-4"
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
          <legend className="text-sm text-muted">Evento</legend>
          <div className="mt-1 grid grid-cols-2 gap-2">
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

        <fieldset>
          <legend className="text-sm text-muted">Equipo</legend>
          <div className="mt-1 grid grid-cols-2 gap-2">
            {[home, away].map((t) => (
              <label
                key={t.id}
                className={`cursor-pointer rounded-md border px-3 py-2 text-center text-sm font-semibold ${teamId === t.id ? "border-sync bg-sync/10" : "border-line"}`}
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
                {t.name}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-[2fr_1fr] gap-3">
          <label className="block text-sm text-muted">
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
          <label className="block text-sm text-muted">
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

      <div className="mt-6 space-y-3 border-t border-line pt-4">
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
              className="field mt-0 flex-1"
              placeholder="Motivo (ej: tormenta eléctrica)"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <button type="submit" className="btn btn-danger" disabled={busy}>
              Suspender
            </button>
          </form>
        )}
      </div>

      {message && (
        <p role="status" className={`mt-4 text-sm ${message.tone === "ok" ? "text-ok" : "text-error"}`}>
          {message.text}
        </p>
      )}
    </section>
  );
}
