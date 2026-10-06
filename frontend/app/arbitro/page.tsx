"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DAYS, DAY_LABELS } from "@/components/organizer/shared";
import { LoginRequired, Notice, Section, StatusBadge } from "@/components/ui";
import { utcDate, utcDay } from "@/lib/services";
import { api, useSession } from "@/lib/session";
import { useAction, useApi } from "@/lib/use-api";
import type { Assignment, Match, Referee, Team } from "@/lib/types";

interface Row extends Assignment {
  match: Match | null;
}

export default function RefereePage() {
  const { user, ready } = useSession();
  const refereeId = user?.role === "arbitro" ? user.refereeId : null;
  const assignments = useApi<Assignment[]>(refereeId ? `/referees/${refereeId}/assignments` : null);
  const [rows, setRows] = useState<Row[]>([]);
  const [teams, setTeams] = useState<Map<number, string>>(new Map());
  const { busy, message, run } = useAction();

  // Datos de cada partido asignado (Fixture Service) y nombres de los equipos (Team Service)
  useEffect(() => {
    if (!assignments.data) return;
    let cancelled = false;
    const list = assignments.data;
    (async () => {
      const matches = await Promise.all(
        list.map((a) => api<Match>("GET", `/matches/${a.matchId}`).catch(() => null)),
      );
      const ids = [...new Set(matches.flatMap((m) => (m ? [m.homeTeam, m.awayTeam] : [])))];
      const found = ids.length ? await api<Team[]>("GET", `/teams?ids=${ids.join(",")}`).catch(() => []) : [];
      if (cancelled) return;
      setTeams(new Map(found.map((t) => [t.id, t.name])));
      setRows(
        list
          .map((a, i) => ({ ...a, match: matches[i] }))
          .sort((a, b) => (a.match?.scheduledAt ?? "").localeCompare(b.match?.scheduledAt ?? "")),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [assignments.data]);

  if (!ready) return null;
  if (!refereeId) return <LoginRequired role="árbitros" />;

  const name = (id: number) => teams.get(id) ?? `Equipo ${id}`;
  const pending = rows.filter((r) => r.match && r.match.status !== "finalizado");
  const played = rows.filter((r) => r.match?.status === "finalizado");

  const table = (list: Row[]) => (
    <ul className="divide-y divide-line rounded-md border border-line bg-surface-2">
      {list.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center gap-3 px-3 py-3 text-sm">
          {r.match ? (
            <>
              <span className="w-36 text-muted">
                {utcDay(r.match.scheduledAt)} {utcDate(r.match.scheduledAt)}
              </span>
              <span className="min-w-48 flex-1 font-semibold">
                {name(r.match.homeTeam)} vs {name(r.match.awayTeam)}
                <span className="block text-xs font-normal text-muted">{r.match.venue}</span>
              </span>
              <StatusBadge status={r.match.status} />
            </>
          ) : (
            <span className="flex-1 text-muted">Partido #{r.matchId}</span>
          )}
          {r.confirmed ? (
            <span className="text-xs font-semibold text-ok">Confirmada</span>
          ) : (
            <button
              className="btn btn-ghost btn-sm"
              disabled={busy}
              onClick={async () => {
                if (await run(async () => {
                  await api("PUT", `/assignments/${r.id}/confirm`);
                  return "Asignación confirmada.";
                }))
                  assignments.reload();
              }}
            >
              Confirmar
            </button>
          )}
          <Link href={`/partidos/${r.matchId}`} className="btn btn-primary btn-sm">
            {r.match?.status === "finalizado" ? "Ver acta" : "Abrir marcador"}
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <main className="space-y-6">
      <header>
        <h1 className="font-display text-4xl font-bold">Mis partidos</h1>
        <p className="mt-1 text-muted">
          El Referee Service te asignó estos partidos al publicarse el calendario. Desde el marcador registras goles,
          tarjetas y sustituciones; solo puedes hacerlo en los partidos que tienes asignados.
        </p>
      </header>
      {assignments.error && <Notice tone="error">{assignments.error}</Notice>}
      {message && <Notice tone={message.tone}>{message.text}</Notice>}

      <Section id="proximos" title="Por jugar">
        {pending.length ? table(pending) : <p className="text-sm text-muted">No tienes partidos pendientes.</p>}
      </Section>
      {played.length > 0 && (
        <Section id="jugados" title="Jugados">
          {table(played)}
        </Section>
      )}
      <Availability refereeId={refereeId} />
    </main>
  );
}

function Availability({ refereeId }: { refereeId: number }) {
  const referee = useApi<Referee>(`/referees/${refereeId}`);
  const [draft, setDays] = useState<string[] | null>(null);
  const days = draft ?? referee.data?.availability ?? null;
  const { busy, message, run } = useAction();

  return (
    <Section
      id="disponibilidad"
      title="Mi disponibilidad"
      description="Días en que puedes pitar. Se usa en las próximas asignaciones automáticas."
    >
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {DAYS.map((d, i) => (
          <label key={d} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={days?.includes(d) ?? false}
              onChange={() => setDays(days?.includes(d) ? days.filter((x) => x !== d) : [...(days ?? []), d])}
            />
            {DAY_LABELS[i]}
          </label>
        ))}
      </div>
      <button
        className="btn btn-primary mt-3"
        disabled={busy || !days?.length}
        onClick={() =>
          run(async () => {
            const r = await api<Referee>("PUT", `/referees/${refereeId}/availability`, { availability: days });
            return `Disponibilidad guardada: ${r.availability.join(", ")}.`;
          })
        }
      >
        Guardar disponibilidad
      </button>
      {message && <p className={`mt-2 text-sm ${message.tone === "ok" ? "text-ok" : "text-error"}`}>{message.text}</p>}
    </Section>
  );
}
