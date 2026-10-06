import { buildStandings, pointsFor, sortStandings } from './standings.util';

const rules = { pointsWin: 3, pointsDraw: 1 };
const scored = (homeTeam: number, awayTeam: number, homeGoals: number, awayGoals: number) => {
  const r = { homeTeam, awayTeam, homeGoals, awayGoals };
  return { ...r, ...pointsFor(r, rules) };
};

describe('pointsFor (reglamento de la categoria)', () => {
  it('victoria local, empate y victoria visitante', () => {
    expect(pointsFor({ homeTeam: 1, awayTeam: 2, homeGoals: 2, awayGoals: 0 }, rules)).toEqual({ homePoints: 3, awayPoints: 0 });
    expect(pointsFor({ homeTeam: 1, awayTeam: 2, homeGoals: 1, awayGoals: 1 }, rules)).toEqual({ homePoints: 1, awayPoints: 1 });
    expect(pointsFor({ homeTeam: 1, awayTeam: 2, homeGoals: 0, awayGoals: 1 }, rules)).toEqual({ homePoints: 0, awayPoints: 3 });
  });

  it('usa los puntos que defina la liga (por ejemplo 2 por victoria)', () => {
    expect(pointsFor({ homeTeam: 1, awayTeam: 2, homeGoals: 3, awayGoals: 1 }, { pointsWin: 2, pointsDraw: 1 }).homePoints).toBe(2);
  });
});

describe('buildStandings', () => {
  it('acumula puntos, partidos y goles de cada equipo', () => {
    const rows = buildStandings([scored(1, 2, 2, 0), scored(2, 3, 1, 1), scored(3, 1, 0, 1)]);
    const team1 = rows.find((r) => r.teamId === 1)!;
    expect(team1).toMatchObject({ points: 6, wins: 2, draws: 0, losses: 0, goalsFor: 3, goalsAgainst: 0, goalDifference: 3 });
    const team2 = rows.find((r) => r.teamId === 2)!;
    expect(team2).toMatchObject({ points: 1, wins: 0, draws: 1, losses: 1, goalDifference: -2 });
  });

  it('es idempotente: calcular dos veces da lo mismo', () => {
    const results = [scored(1, 2, 2, 0), scored(2, 3, 1, 1)];
    expect(buildStandings(results)).toEqual(buildStandings(results));
  });

  it('incluye en cero a los equipos que aun no juegan', () => {
    const rows = buildStandings([scored(1, 2, 1, 0)], [1, 2, 3, 4]);
    expect(rows).toHaveLength(4);
    expect(rows.find((r) => r.teamId === 4)).toMatchObject({ points: 0, wins: 0 });
  });
});

describe('sortStandings (criterio de desempate)', () => {
  const row = (teamId: number, points: number, goalsFor: number, goalsAgainst: number, wins = 0) => ({
    teamId,
    points,
    wins,
    draws: 0,
    losses: 0,
    goalsFor,
    goalsAgainst,
    goalDifference: goalsFor - goalsAgainst,
  });

  it('ordena primero por puntos', () => {
    const sorted = sortStandings([row(1, 3, 1, 0), row(2, 6, 1, 5)]);
    expect(sorted.map((r) => r.teamId)).toEqual([2, 1]);
  });

  it('en empate a puntos usa la diferencia de goles', () => {
    const sorted = sortStandings([row(1, 6, 4, 3), row(2, 6, 3, 0)], 'diferencia_de_goles');
    expect(sorted.map((r) => r.teamId)).toEqual([2, 1]);
  });

  it('con goles_a_favor gana el que mas anoto', () => {
    const sorted = sortStandings([row(1, 6, 8, 7), row(2, 6, 3, 0)], 'goles_a_favor');
    expect(sorted.map((r) => r.teamId)).toEqual([1, 2]);
  });
});
