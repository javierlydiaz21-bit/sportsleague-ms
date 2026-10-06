import { getJson, utcDate } from "./services";
import type { Category, League, LiveMatch, Match, Season, Team } from "./types";

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

/** Fecha de hoy en Colombia (los partidos se programan por dia). */
export function today(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
}

export function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "Hoy", "Ayer", "Mañana" o el dia de la semana abreviado ("Mar"). */
export function dayLabel(date: string) {
  const t = today();
  if (date === t) return "Hoy";
  if (date === addDays(t, -1)) return "Ayer";
  if (date === addDays(t, 1)) return "Mañana";
  const weekday = new Date(`${date}T00:00:00Z`)
    .toLocaleDateString("es-CO", { weekday: "short", timeZone: "UTC" })
    .replace(/\./g, "");
  return weekday.charAt(0).toUpperCase() + weekday.slice(1);
}

export interface MatchView extends Match {
  jornada: number;
  score: { home: number; away: number } | null;
  minute: number | null; // ultimo minuto con eventos, para partidos en vivo
}

export interface Competition {
  league: League;
  season: Season;
  category: Category | undefined;
  matches: MatchView[];
}

/**
 * Todos los partidos de todas las temporadas, con jornada, marcador y minuto en vivo.
 * Junta Fixture (calendario), Live Score (marcadores) y League (competiciones).
 */
export async function allCompetitions() {
  const response = await getJson<League[]>("/leagues");
  const leagues = response ?? [];
  const seasons = leagues.flatMap((league) => league.seasons.map((season) => ({ league, season })));
  const [fixtures, scores] = await Promise.all([
    Promise.all(seasons.map(({ season }) => getJson<Match[]>(`/fixtures/${season.id}`))),
    liveScores(),
  ]);
  const live = [...scores.values()].filter((m) => m.status === "en_curso");
  const details = await Promise.all(live.map((m) => getJson<LiveMatch>(`/matches/${m.matchId}/live`)));
  const minutes = new Map(details.filter(Boolean).map((d) => [d!.matchId, d!.events.at(-1)?.minute ?? 0]));

  const competitions: Competition[] = seasons.map(({ league, season }, i) => {
    const matches = fixtures[i] ?? [];
    const dates = [...new Set(matches.map((m) => utcDate(m.scheduledAt)))].sort();
    // Cada temporada tiene un solo calendario: su categoria es la de sus equipos
    return {
      league,
      season,
      category: league.categories.length === 1 ? league.categories[0] : undefined,
      matches: matches.map((m) => {
        const s = scores.get(m.id);
        return {
          ...m,
          jornada: dates.indexOf(utcDate(m.scheduledAt)) + 1,
          score: s ? s.score : null,
          minute: m.status === "en_curso" ? (minutes.get(m.id) ?? null) : null,
        };
      }),
    };
  });
  return { leagues, competitions, ok: response !== null };
}

/** Partidos de una temporada con jornada, marcador y minuto en vivo. */
export async function seasonMatches(seasonId: number): Promise<MatchView[] | null> {
  const [matches, scores] = await Promise.all([getJson<Match[]>(`/fixtures/${seasonId}`), liveScores()]);
  if (!matches) return null;
  const live = matches.filter((m) => m.status === "en_curso");
  const details = await Promise.all(live.map((m) => getJson<LiveMatch>(`/matches/${m.id}/live`)));
  const minutes = new Map(details.filter(Boolean).map((d) => [d!.matchId, d!.events.at(-1)?.minute ?? 0]));
  const dates = [...new Set(matches.map((m) => utcDate(m.scheduledAt)))].sort();
  return matches.map((m) => ({
    ...m,
    jornada: dates.indexOf(utcDate(m.scheduledAt)) + 1,
    score: scores.get(m.id)?.score ?? null,
    minute: m.status === "en_curso" ? (minutes.get(m.id) ?? null) : null,
  }));
}

export type Result = "G" | "E" | "P";

/** Ultimos resultados de cada equipo (G/E/P), del mas antiguo al mas reciente. */
export function formByTeam(matches: MatchView[], limit = 5): Map<number, Result[]> {
  const form = new Map<number, Result[]>();
  const played = matches
    .filter((m) => m.status === "finalizado" && m.score)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt) || a.id - b.id);
  for (const m of played) {
    const { home, away } = m.score!;
    const push = (team: number, r: Result) => form.set(team, [...(form.get(team) ?? []), r].slice(-limit));
    push(m.homeTeam, home > away ? "G" : home === away ? "E" : "P");
    push(m.awayTeam, away > home ? "G" : home === away ? "E" : "P");
  }
  return form;
}
