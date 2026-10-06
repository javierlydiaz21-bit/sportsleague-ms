import { countByStatus, estimateAttendance, performanceTrend, suspendedMatches } from './transform';

const live = (match_id: number, peak_viewers: number, status = 'finalizado', suspension_reason: string | null = null) => ({
  match_id,
  season_id: 1,
  status,
  suspension_reason,
  peak_viewers,
});

describe('estimateAttendance', () => {
  it('multiplica el pico de espectadores por el factor y omite partidos sin audiencia', () => {
    expect(estimateAttendance([live(1, 40), live(2, 0)], 2.5)).toEqual([
      { matchId: 1, seasonId: 1, estimatedAttendance: 100 },
    ]);
  });
});

describe('suspendedMatches', () => {
  it('toma los suspendidos del Fixture y el motivo del Live Score', () => {
    const fixture = [
      { id: 1, season_id: 1, status: 'suspendido' },
      { id: 2, season_id: 1, status: 'finalizado' },
      { id: 3, season_id: 1, status: 'suspendido' },
    ];
    expect(suspendedMatches(fixture, [live(1, 0, 'suspendido', 'Lluvia')])).toEqual([
      { matchId: 1, seasonId: 1, reason: 'Lluvia' },
      { matchId: 3, seasonId: 1, reason: 'Sin motivo registrado' },
    ]);
  });
});

describe('performanceTrend', () => {
  const result = (match_id: number, day: number, home_team: number, away_team: number, home_points: number | null, away_points: number | null) => ({
    match_id,
    season_id: 1,
    home_team,
    away_team,
    home_points,
    away_points,
    completed_at: new Date(`2026-10-${String(day).padStart(2, '0')}T20:00:00Z`),
  });

  it('acumula los puntos de cada equipo en orden cronologico', () => {
    const rows = performanceTrend([
      result(2, 10, 1, 3, 1, 1), // segunda fecha: empate
      result(1, 3, 1, 2, 3, 0), // primera fecha: gana el equipo 1
    ]);
    const team1 = rows.filter((r) => r.teamId === 1);
    expect(team1).toEqual([
      { teamId: 1, seasonId: 1, matchNumber: 1, matchId: 1, points: 3, trendMetric: 3 },
      { teamId: 1, seasonId: 1, matchNumber: 2, matchId: 2, points: 4, trendMetric: 2 },
    ]);
  });

  it('omite las actas que aun no tienen puntos calculados', () => {
    expect(performanceTrend([result(1, 3, 1, 2, null, null)])).toEqual([]);
  });
});

describe('countByStatus', () => {
  it('cuenta los partidos de la liga por estado', () => {
    const fixture = ['programado', 'programado', 'en_curso', 'finalizado', 'suspendido'].map((status, i) => ({
      id: i,
      season_id: 1,
      status,
    }));
    expect(countByStatus(fixture)).toEqual({ totalMatches: 5, scheduled: 2, live: 1, played: 1, suspended: 1 });
  });
});
