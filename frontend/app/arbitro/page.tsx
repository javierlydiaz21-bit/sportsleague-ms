"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Crest from "@/components/crest";
import { DAYS, DAY_LABELS } from "@/components/organizer/shared";
import { Band, Card, FormMessage, LoginRequired, Notice, Page, StatusChip } from "@/components/ui";
import { shortDate } from "@/lib/services";
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
      const matches = await Promise.all(list.map((a) => api<Match>("GET", `/matches/${a.matchId}`).catch(() => null)));
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
    <div className="scroll">
      <table className="data">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Partido</th>
            <th className="hide-sm">Cancha</th>
            <th>Estado</th>
            <th>Asignación</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {list.map((r) => (
            <tr key={r.id}>
              <td className="whitespace-nowrap">{r.match ? shortDate(r.match.scheduledAt) : ""}</td>
              <td>
                {r.match ? (
                  <>
                    <span className="team-cell">
                      <Crest name={name(r.match.homeTeam)} size={24} />
                      {name(r.match.homeTeam)}
                    </span>
                    <span className="team-cell">
                      <Crest name={name(r.match.awayTeam)} size={24} />
                      {name(r.match.awayTeam)}
                    </span>
                  </>
                ) : (
                  `Partido #${r.matchId}`
                )}
              </td>
              <td className="hide-sm">{r.match?.venue}</td>
              <td>{r.match && <StatusChip status={r.match.status} />}</td>
              <td>
                {r.confirmed ? (
                  <span className="elig elig-elegible">Confirmada</span>
                ) : (
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={busy}
                    onClick={async () => {
                      if (
                        await run(async () => {
                          await api("PUT", `/assignments/${r.id}/confirm`);
                          return "Asignación confirmada.";
                        })
                      )
                        assignments.reload();
                    }}
                  >
                    Confirmar
                  </button>
                )}
              </td>
              <td>
                <Link href={`/partidos/${r.matchId}`} className="btn btn-blue btn-sm">
                  {r.match?.status === "finalizado" ? "Ver acta" : "Abrir marcador"}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <Band
        icon="arbitros"
        title="Mis partidos"
        intro="El Referee Service te asignó estos partidos al publicarse el calendario. Desde el marcador registras goles, tarjetas y cambios, solo en los partidos que tienes asignados."
      />
      <Page>
        {assignments.error && <Notice tone="error">{assignments.error}</Notice>}
        {message && <Notice tone={message.tone}>{message.text}</Notice>}
        <Card title="Por jugar" hint="Confirma cada asignación para que la liga sepa que vas a pitar.">
          {pending.length ? table(pending) : <p className="empty">{assignments.loading ? "Cargando..." : "No tienes partidos pendientes."}</p>}
        </Card>
        {played.length > 0 && <Card title="Jugados">{table(played)}</Card>}
        <Availability refereeId={refereeId} />
      </Page>
    </>
  );
}

function Availability({ refereeId }: { refereeId: number }) {
  const referee = useApi<Referee>(`/referees/${refereeId}`);
  const [draft, setDays] = useState<string[] | null>(null);
  const days = draft ?? referee.data?.availability ?? null;
  const { busy, message, run } = useAction();

  return (
    <Card title="Mi disponibilidad" hint="Días en que puedes pitar. Se usa en las próximas asignaciones automáticas.">
      <fieldset className="checks">
        <legend>Días disponibles</legend>
        {DAYS.map((d, i) => (
          <label key={d}>
            <input
              type="checkbox"
              checked={days?.includes(d) ?? false}
              onChange={() => setDays(days?.includes(d) ? days.filter((x) => x !== d) : [...(days ?? []), d])}
            />
            {DAY_LABELS[i]}
          </label>
        ))}
      </fieldset>
      <div className="factions">
        <button
          type="button"
          className="btn btn-blue"
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
      </div>
      <FormMessage message={message} />
    </Card>
  );
}
