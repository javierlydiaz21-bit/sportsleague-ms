"use client";

/*
 * 5. Partidos y actas, lista (diseño: viewPartidos, ruta #/partidos). Por el API Gateway:
 *   Fixture Service ..... GET /fixtures/{seasonId}                 partidos de la temporada
 *   Live Score Service .. GET /live-matches?status=..., GET /matches/{id}/live   marcador y minuto en vivo
 *   Team Service ........ GET /teams?ids={ids}                     nombres de los equipos
 */

import Link from "next/link";
import { useState } from "react";
import { useLeague } from "@/components/league-context";
import { MatchTile } from "@/components/match-row";
import { EmptyCard } from "@/components/ui";
import { seasonMatches } from "@/lib/server-data";
import { shortDate, utcDate } from "@/lib/services";
import { api } from "@/lib/session";
import { useLoad } from "@/lib/use-api";
import type { League, Match, Season, Team } from "@/lib/types";
import { PanelSection } from "./panel";
import { today } from "./shared";

export default function MatchesSection() {
  return (
    <PanelSection
      id="partidos"
      intro="Sigue los partidos en curso y corrige el acta de los que ya terminaron. Los eventos los registra el árbitro desde su app."
    >
      <Matches />
    </PanelSection>
  );
}

/** Cantidad de partidos de cada temporada, para elegir la temporada inicial. */
async function loadSeasons(league: League) {
  const lists = await Promise.all(league.seasons.map((s) => api<Match[]>("GET", `/fixtures/${s.id}`).catch(() => [] as Match[])));
  return new Map(league.seasons.map((s, i) => [s.id, lists[i].length]));
}

/** Partidos de la temporada con marcador (Fixture + Live Score) y nombres (Team). */
async function loadSeason(seasonId: number) {
  const matches = (await seasonMatches(seasonId)) ?? [];
  const ids = [...new Set(matches.flatMap((m) => [m.homeTeam, m.awayTeam]))];
  const teams = ids.length ? await api<Team[]>("GET", `/teams?ids=${ids.join(",")}`).catch(() => [] as Team[]) : [];
  return { matches, names: new Map(teams.map((t) => [t.id, t.name])) };
}

function defaultSeason(seasons: Season[], counts: Map<number, number>) {
  const t = today();
  const withMatches = seasons.filter((s) => counts.get(s.id));
  const current = withMatches.find((s) => utcDate(s.startDate) <= t && t <= utcDate(s.endDate));
  return (current ?? withMatches.at(-1) ?? seasons.at(-1))!.id;
}

function Matches() {
  const { leagues, league } = useLeague();
  const seasons = [...(league?.seasons ?? [])].sort((a, b) => a.year - b.year || a.id - b.id);
  const counts = useLoad(league ? `partidos-temporadas:${league.id}:${seasons.length}` : null, () => loadSeasons(league!));
  const [choice, setChoice] = useState<{ league: number; season: number } | null>(null);
  const sid = league && counts.data ? (choice?.league === league.id ? choice.season : seasons.length ? defaultSeason(seasons, counts.data) : null) : null;
  const data = useLoad(sid ? `partidos:${sid}` : null, () => loadSeason(sid!));

  if (!leagues || (league && seasons.length && !counts.data)) return <p className="empty">Cargando...</p>;
  const tools = sid && (
    <div className="toolbar">
      <label className="fl">
        Temporada
        <select value={sid} onChange={(e) => setChoice({ league: league!.id, season: Number(e.target.value) })}>
          {seasons.map((s) => (
            <option key={s.id} value={s.id}>
              {s.year}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
  if (!sid || (data.data && !data.data.matches.length)) {
    return (
      <>
        {tools}
        <EmptyCard title="Todavía no hay partidos" text="Genera el calendario para ver aquí los partidos." href="/calendario" label="Ir a Calendario" />
      </>
    );
  }
  if (!data.data) return <>{tools}<p className="empty">{data.error || "Cargando..."}</p></>;

  const { matches, names } = data.data;
  const name = (id: number) => names.get(id) ?? `Equipo ${id}`;
  const sorted = [...matches].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt) || a.id - b.id);
  const live = sorted.filter((m) => m.status === "en_curso");
  const fin = sorted.filter((m) => m.status === "finalizado").reverse();

  return (
    <>
      {tools}
      <section className="card">
        <h2>En curso</h2>
        {live.length ? (
          <div className="tiles">
            {live.map((m) => (
              <MatchTile key={m.id} match={m} home={name(m.homeTeam)} away={name(m.awayTeam)} href={`/partidos/${m.id}`} />
            ))}
          </div>
        ) : (
          <p className="empty">No hay partidos jugándose ahora.</p>
        )}
      </section>
      <section className="card">
        <h2>Finalizados</h2>
        {fin.length ? (
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
                {fin.map((m) => (
                  <tr key={m.id}>
                    <td className="pos">{m.jornada}</td>
                    <td>{shortDate(m.scheduledAt)}</td>
                    <td>
                      {name(m.homeTeam)} contra {name(m.awayTeam)}
                    </td>
                    <td className="num pts">{m.score ? `${m.score.home}–${m.score.away}` : "0–0"}</td>
                    <td>
                      <Link className="linkish" href={`/partidos/${m.id}`}>
                        Abrir acta
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
      </section>
    </>
  );
}
