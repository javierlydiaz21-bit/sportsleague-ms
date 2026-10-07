"use client";

import Link from "next/link";
import { useState } from "react";
import Crest from "@/components/crest";
import { MatchTile } from "@/components/match-row";
import { Card, EmptyCard, StatusChip } from "@/components/ui";
import { seasonMatches, type MatchView } from "@/lib/server-data";
import { shortDate } from "@/lib/services";
import { useLoad } from "@/lib/use-api";
import type { League } from "@/lib/types";
import OrganizerSection from "./panel";
import { SeasonPicker, defaultSeasonId, flatten, useAllMatches } from "./shared";

export default function MatchesSection() {
  return <OrganizerSection id="partidos">{({ leagues }) => <Matches leagues={leagues} />}</OrganizerSection>;
}

function Matches({ leagues }: { leagues: League[] }) {
  const { seasons } = flatten(leagues);
  const all = useAllMatches(leagues);
  const [choice, setChoice] = useState<number | null>(null);
  const seasonId = all.data ? (choice ?? defaultSeasonId(seasons, all.data.matches)) : null;
  // Marcadores y minuto en vivo de la temporada (Fixture + Live Score)
  const detail = useLoad(seasonId ? `season:${seasonId}` : null, () => seasonMatches(seasonId!));

  if (!seasons.length || (all.data && !all.data.matches.length)) {
    return (
      <EmptyCard
        title="Todavía no hay partidos"
        text="Genera el calendario de una temporada para ver aquí sus partidos."
        href="/organizador/calendario"
        label="Ir a Calendario"
      />
    );
  }
  if (!all.data) return <p className="empty">{all.error || "Cargando los partidos..."}</p>;

  const name = (id: number) => all.data!.names.get(id) ?? `Equipo ${id}`;
  const list = detail.data ?? [];
  const live = list.filter((m) => m.status === "en_curso");
  const upcoming = list.filter((m) => m.status === "programado").sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const done = list
    .filter((m) => m.status === "finalizado" || m.status === "suspendido")
    .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt) || b.id - a.id);

  const match = (m: MatchView) => (
    <>
      <span className="team-cell">
        <Crest name={name(m.homeTeam)} size={24} />
        {name(m.homeTeam)}
      </span>
      <span className="team-cell">
        <Crest name={name(m.awayTeam)} size={24} />
        {name(m.awayTeam)}
      </span>
    </>
  );

  return (
    <>
      <div className="toolbar">
        <SeasonPicker seasons={seasons} value={seasonId} onChange={setChoice} />
        <button type="button" className="btn" onClick={detail.reload}>
          Actualizar
        </button>
      </div>
      {detail.loading && <p className="empty">Cargando los partidos...</p>}
      {detail.data === null && !detail.loading && (
        <EmptyCard title="No pudimos cargar la temporada" text="Si los servicios están despertando, actualiza en un minuto." />
      )}
      {detail.data && (
        <>
          <Card title="En curso" hint="El marcador cambia con cada evento que registra el árbitro.">
            {live.length ? (
              <div className="tiles">
                {live.map((m) => (
                  <MatchTile key={m.id} match={m} home={name(m.homeTeam)} away={name(m.awayTeam)} />
                ))}
              </div>
            ) : (
              <p className="empty">No hay partidos jugándose ahora.</p>
            )}
          </Card>

          <Card title="Por jugar" hint="Desde el marcador, el árbitro asignado o un organizador registran los eventos.">
            {upcoming.length ? (
              <div className="scroll">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Jornada</th>
                      <th>Fecha</th>
                      <th>Partido</th>
                      <th className="hide-sm">Cancha</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {upcoming.map((m) => (
                      <tr key={m.id}>
                        <td className="pos">{m.jornada}</td>
                        <td className="whitespace-nowrap">{shortDate(m.scheduledAt)}</td>
                        <td>{match(m)}</td>
                        <td className="hide-sm">{m.venue}</td>
                        <td>
                          <Link className="linkish" href={`/partidos/${m.id}`}>
                            Abrir marcador
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty">No quedan partidos programados.</p>
            )}
          </Card>

          <Card
            title="Finalizados"
            hint="Si un evento quedó mal registrado, corrígelo en el acta: el marcador, la tabla y los goleadores se recalculan."
          >
            {done.length ? (
              <div className="scroll">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Jornada</th>
                      <th>Fecha</th>
                      <th>Partido</th>
                      <th className="num">Resultado</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {done.map((m) => (
                      <tr key={m.id}>
                        <td className="pos">{m.jornada}</td>
                        <td className="whitespace-nowrap">{shortDate(m.scheduledAt)}</td>
                        <td>{match(m)}</td>
                        <td className="num">
                          {m.status === "suspendido" ? (
                            <StatusChip status={m.status} />
                          ) : (
                            <span className="pts">{m.score ? `${m.score.home}–${m.score.away}` : "–"}</span>
                          )}
                        </td>
                        <td>
                          <Link className="linkish" href={`/partidos/${m.id}`}>
                            {m.status === "suspendido" ? "Ver partido" : "Abrir acta"}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty">Todavía no hay partidos finalizados.</p>
            )}
          </Card>
        </>
      )}
    </>
  );
}
