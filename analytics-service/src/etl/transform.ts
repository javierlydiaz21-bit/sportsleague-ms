/** Filas leidas de las replicas de solo lectura. */
export interface FixtureMatchRow {
  id: number;
  season_id: number;
  status: string;
}

export interface LiveMatchRow {
  match_id: number;
  season_id: number;
  status: string;
  suspension_reason: string | null;
  peak_viewers: number;
}

export interface MatchResultRow {
  match_id: number;
  season_id: number;
  home_team: number;
  away_team: number;
  home_points: number | null;
  away_points: number | null;
  completed_at: Date;
}

/**
 * Asistencia estimada por partido: el pico de espectadores que siguieron el
 * marcador en vivo, multiplicado por un factor configurable (ATTENDANCE_FACTOR)
 * que representa cuantas personas hay en la cancha por cada espectador conectado.
 */
export function estimateAttendance(live: LiveMatchRow[], factor: number) {
  return live
    .filter((m) => m.peak_viewers > 0)
    .map((m) => ({
      matchId: m.match_id,
      seasonId: m.season_id,
      estimatedAttendance: Math.round(m.peak_viewers * factor),
    }));
}

/** Partidos suspendidos (Fixture DB) con su motivo (Live Score DB). */
export function suspendedMatches(fixture: FixtureMatchRow[], live: LiveMatchRow[]) {
  const reasons = new Map(live.map((m) => [m.match_id, m.suspension_reason]));
  return fixture
    .filter((m) => m.status === 'suspendido')
    .map((m) => ({ matchId: m.id, seasonId: m.season_id, reason: reasons.get(m.id) ?? 'Sin motivo registrado' }));
}

/**
 * Evolucion del rendimiento de cada equipo (Statistics DB): por cada partido
 * jugado, los puntos acumulados y los puntos por partido hasta ese momento.
 */
export function performanceTrend(results: MatchResultRow[]) {
  const ordered = [...results]
    .filter((r) => r.home_points !== null && r.away_points !== null)
    .sort((a, b) => +new Date(a.completed_at) - +new Date(b.completed_at) || a.match_id - b.match_id);
  const progress = new Map<string, { played: number; points: number }>();
  const rows: Array<{
    teamId: number;
    seasonId: number;
    matchNumber: number;
    matchId: number;
    points: number;
    trendMetric: number;
  }> = [];

  for (const r of ordered) {
    for (const [teamId, pts] of [
      [r.home_team, r.home_points!],
      [r.away_team, r.away_points!],
    ]) {
      const key = `${r.season_id}-${teamId}`;
      const p = progress.get(key) ?? { played: 0, points: 0 };
      p.played++;
      p.points += pts;
      progress.set(key, p);
      rows.push({
        teamId,
        seasonId: r.season_id,
        matchNumber: p.played,
        matchId: r.match_id,
        points: p.points,
        trendMetric: Math.round((p.points / p.played) * 100) / 100,
      });
    }
  }
  return rows;
}

/** Partidos de la liga por estado (Fixture DB), para el resumen de KPIs. */
export function countByStatus(fixture: FixtureMatchRow[]) {
  const count = (status: string) => fixture.filter((m) => m.status === status).length;
  return {
    totalMatches: fixture.length,
    scheduled: count('programado'),
    live: count('en_curso'),
    played: count('finalizado'),
    suspended: count('suspendido'),
  };
}
