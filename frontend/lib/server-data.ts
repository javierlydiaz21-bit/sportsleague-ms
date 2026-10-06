import { getJson } from "./services";
import type { League, LiveMatch, Team } from "./types";

/** Equipos (con su plantilla) por id, para mostrar nombres en lugar de ids. */
export async function teamsById(ids: number[]): Promise<Map<number, Team>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const teams = await getJson<Team[]>(`/teams?ids=${unique.join(",")}`);
  return new Map((teams ?? []).map((t) => [t.id, t]));
}

export const teamName = (teams: Map<number, Team>, id: number) => teams.get(id)?.name ?? `Equipo ${id}`;

/** Liga y temporada a las que pertenece un id de temporada. */
export async function findSeason(seasonId: number) {
  const leagues = (await getJson<League[]>("/leagues")) ?? [];
  for (const league of leagues) {
    const season = league.seasons.find((s) => s.id === seasonId);
    if (season) return { league, season };
  }
  return null;
}

/** Marcadores de los partidos en vivo y finalizados (Live Score Service). */
export async function liveScores(): Promise<Map<number, LiveMatch>> {
  const [live, done] = await Promise.all([
    getJson<LiveMatch[]>("/live-matches?status=en_curso"),
    getJson<LiveMatch[]>("/live-matches?status=finalizado"),
  ]);
  return new Map([...(live ?? []), ...(done ?? [])].map((m) => [m.matchId, m]));
}
