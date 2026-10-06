export interface ResultRow {
  homeTeam: number;
  awayTeam: number;
  homeGoals: number;
  awayGoals: number;
}

export interface ScoredResult extends ResultRow {
  homePoints: number;
  awayPoints: number;
}

export interface StandingRow {
  teamId: number;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

export interface Scoring {
  pointsWin: number;
  pointsDraw: number;
}

/** Puntos de local y visitante segun el reglamento de la categoria (2.2). */
export function pointsFor(result: ResultRow, rules: Scoring) {
  if (result.homeGoals > result.awayGoals) return { homePoints: rules.pointsWin, awayPoints: 0 };
  if (result.homeGoals < result.awayGoals) return { homePoints: 0, awayPoints: rules.pointsWin };
  return { homePoints: rules.pointsDraw, awayPoints: rules.pointsDraw };
}

/**
 * Tabla de posiciones calculada desde cero con todas las actas de la temporada.
 * Al no acumular sobre el valor anterior, reprocesar la misma acta da siempre el
 * mismo resultado (idempotencia, documento 1.5). `teamIds` agrega en cero a los
 * equipos que aun no juegan.
 */
export function buildStandings(results: ScoredResult[], teamIds: number[] = []): StandingRow[] {
  const table = new Map<number, StandingRow>();
  const row = (teamId: number) => {
    if (!table.has(teamId)) {
      table.set(teamId, { teamId, points: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0 });
    }
    return table.get(teamId)!;
  };
  teamIds.forEach(row);

  for (const r of results) {
    const sides = [
      { team: row(r.homeTeam), scored: r.homeGoals, conceded: r.awayGoals, points: r.homePoints },
      { team: row(r.awayTeam), scored: r.awayGoals, conceded: r.homeGoals, points: r.awayPoints },
    ];
    for (const s of sides) {
      s.team.points += s.points;
      s.team.goalsFor += s.scored;
      s.team.goalsAgainst += s.conceded;
      s.team.goalDifference = s.team.goalsFor - s.team.goalsAgainst;
      if (s.scored > s.conceded) s.team.wins++;
      else if (s.scored === s.conceded) s.team.draws++;
      else s.team.losses++;
    }
  }
  return [...table.values()];
}

/**
 * Ordena la tabla: primero por puntos y, en igualdad, por el criterio de desempate
 * del reglamento (2.2). Criterios reconocidos: diferencia_de_goles (por defecto),
 * goles_a_favor y partidos_ganados.
 */
export function sortStandings<T extends StandingRow>(rows: T[], tiebreaker = 'diferencia_de_goles'): T[] {
  const chains: Record<string, Array<keyof StandingRow>> = {
    diferencia_de_goles: ['goalDifference', 'goalsFor', 'wins'],
    goles_a_favor: ['goalsFor', 'goalDifference', 'wins'],
    partidos_ganados: ['wins', 'goalDifference', 'goalsFor'],
  };
  const chain = chains[tiebreaker] ?? chains.diferencia_de_goles;
  return [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    for (const key of chain) {
      if (b[key] !== a[key]) return b[key] - a[key];
    }
    return a.teamId - b.teamId;
  });
}
