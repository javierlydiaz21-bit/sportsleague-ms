"use client";

import { Field } from "@/components/ui";
import { today as colombiaToday } from "@/lib/server-data";
import { api } from "@/lib/session";
import { useLoad } from "@/lib/use-api";
import type { Assignment, League, Match, Referee, Season, Team } from "@/lib/types";

export const DAYS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
export const DAY_LABELS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
export const dayNames = (list: string[]) => DAYS.filter((d) => list.includes(d)).map((d) => DAY_LABELS[DAYS.indexOf(d)]).join(", ");

export const today = colombiaToday;

export function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

/** Temporadas y categorías de todas las ligas, para los selectores. */
export function flatten(leagues: League[]) {
  return {
    seasons: leagues
      .flatMap((l) => l.seasons.map((s) => ({ ...s, league: l })))
      .sort((a, b) => a.league.id - b.league.id || a.year - b.year || a.id - b.id),
    categories: leagues.flatMap((l) => l.categories.map((c) => ({ ...c, league: l }))),
  };
}

/**
 * Temporada que se muestra al entrar: la que se está jugando, si no la última con
 * calendario, y si ninguna tiene, la más reciente.
 */
export function defaultSeasonId(seasons: Season[], matches: Match[]) {
  if (!seasons.length) return null;
  const t = today();
  const withMatches = seasons.filter((s) => matches.some((m) => m.seasonId === s.id));
  const current = withMatches.find((s) => s.startDate.slice(0, 10) <= t && t <= s.endDate.slice(0, 10));
  const latest = (list: Season[]) => [...list].sort((a, b) => a.year - b.year || a.id - b.id).at(-1);
  return (current ?? latest(withMatches) ?? latest(seasons))!.id;
}

/** Partidos de todas las temporadas (Fixture Service) y los nombres de sus equipos (Team Service). */
export function useAllMatches(leagues: League[]) {
  const ids = leagues.flatMap((l) => l.seasons.map((s) => s.id));
  return useLoad(`matches:${ids.join(",")}`, async () => {
    const lists = await Promise.all(ids.map((id) => api<Match[]>("GET", `/fixtures/${id}`).catch(() => [] as Match[])));
    const matches = lists.flat();
    const teamIds = [...new Set(matches.flatMap((m) => [m.homeTeam, m.awayTeam]))];
    const teams = teamIds.length ? await api<Team[]>("GET", `/teams?ids=${teamIds.join(",")}`) : [];
    return { matches, names: new Map(teams.map((t) => [t.id, t.name])) };
  });
}

/** Árbitros registrados y la asignación de cada partido (Referee Service). */
export function useAssignments() {
  return useLoad("assignments", async () => {
    const referees = await api<Referee[]>("GET", "/referees");
    const lists = await Promise.all(
      referees.map((r) => api<Assignment[]>("GET", `/referees/${r.id}/assignments`).catch(() => [] as Assignment[])),
    );
    return { referees, byMatch: new Map(lists.flat().map((a) => [a.matchId, a])) };
  });
}

export function SeasonPicker({
  seasons,
  value,
  onChange,
}: {
  seasons: Array<Season & { league: League }>;
  value: number | null;
  onChange: (id: number) => void;
}) {
  const many = new Set(seasons.map((s) => s.league.id)).size > 1;
  return (
    <Field label="Temporada">
      <select value={value ?? ""} onChange={(e) => onChange(Number(e.target.value))}>
        {seasons.map((s) => (
          <option key={s.id} value={s.id}>
            {many ? `${s.league.name} ${s.year}` : s.year}
          </option>
        ))}
      </select>
    </Field>
  );
}
