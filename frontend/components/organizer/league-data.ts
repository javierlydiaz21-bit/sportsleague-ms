/*
 * Datos guardados de una liga para calcular el estado de su configuración. Por el API Gateway:
 *   Team Service .... GET /teams?categoryId={id}    equipos (y jugadores) de cada categoría
 *   Fixture Service . GET /fixtures/{seasonId}      partidos del calendario de cada temporada
 *   Referee Service . GET /referees                 árbitros certificados en las categorías de la liga
 */

import { setupStages, type SetupData } from "@/lib/league-setup";
import { api } from "@/lib/session";
import type { League, Match, Referee, Team } from "@/lib/types";

export interface LeagueSetup {
  data: SetupData;
  teams: Team[];
  matches: Record<number, Match[]>;
  referees: Referee[];
}

export async function loadLeagueSetup(league: League): Promise<LeagueSetup> {
  const [teamLists, matchLists, allReferees] = await Promise.all([
    Promise.all(league.categories.map((c) => api<Team[]>("GET", `/teams?categoryId=${c.id}`))),
    Promise.all(league.seasons.map((s) => api<Match[]>("GET", `/fixtures/${s.id}`).catch(() => [] as Match[]))),
    league.categories.length ? api<Referee[]>("GET", "/referees") : Promise.resolve([] as Referee[]),
  ]);
  const catIds = new Set(league.categories.map((c) => c.id));
  const referees = allReferees.filter((r) => r.categoriesCertified.some((id) => catIds.has(id)));
  const matches = Object.fromEntries(league.seasons.map((s, i) => [s.id, matchLists[i]]));
  return {
    teams: teamLists.flat(),
    matches,
    referees,
    data: {
      seasons: league.seasons,
      categories: league.categories,
      teamsPerCategory: Object.fromEntries(league.categories.map((c, i) => [c.id, teamLists[i].length])),
      matchesPerSeason: Object.fromEntries(league.seasons.map((s, i) => [s.id, matchLists[i].length])),
      referees: referees.length,
    },
  };
}

/** Clave de carga: cambia cuando cambian las temporadas, las categorías o sus reglamentos. */
export const setupKey = (league: League) =>
  `${league.id}:${league.seasons.map((s) => s.id).join(",")}:${league.categories.map((c) => `${c.id}${c.rule ? "r" : ""}`).join(",")}`;

export const stagesOf = (s: LeagueSetup) => setupStages(s.data);
