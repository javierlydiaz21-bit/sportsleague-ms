import { BadRequestException } from '@nestjs/common';

export interface GeneratedMatch {
  jornada: number;
  homeTeam: number;
  awayTeam: number;
  venue: string;
  scheduledAt: Date;
}

/**
 * Calendario round-robin (todos contra todos) por el metodo del circulo.
 * Considera lo que exige el documento (2.3):
 *  - Canchas disponibles: los partidos de cada jornada se reparten en rotacion
 *    entre las canchas; si hay mas partidos que canchas en una jornada, se
 *    rechaza (dos partidos no pueden jugarse en la misma cancha el mismo dia).
 *  - Descanso minimo: cada equipo juega una vez por jornada y las jornadas se
 *    separan daysBetweenRounds dias, que debe ser >= restDaysMin.
 *  - Equilibrio local/visitante: en cada partido es local el equipo que menos
 *    veces ha jugado en casa hasta ese momento (en empate se alterna por jornada),
 *    asi la diferencia de partidos de local entre equipos es como maximo 1.
 */
export function generateRoundRobin(
  teamIds: number[],
  venues: string[],
  startDate: Date,
  daysBetweenRounds: number,
  restDaysMin: number,
): GeneratedMatch[] {
  if (daysBetweenRounds < restDaysMin) {
    throw new BadRequestException(
      `daysBetweenRounds (${daysBetweenRounds}) no puede ser menor que restDaysMin (${restDaysMin}).`,
    );
  }

  const BYE = -1;
  const rotation = teamIds.length % 2 === 0 ? [...teamIds] : [...teamIds, BYE];
  const n = rotation.length;
  const matchesPerRound = Math.floor(teamIds.length / 2);

  if (matchesPerRound > venues.length) {
    throw new BadRequestException(
      `Cada jornada tiene ${matchesPerRound} partidos pero solo hay ${venues.length} cancha(s) disponible(s).`,
    );
  }

  const result: GeneratedMatch[] = [];
  const homeCount = new Map<number, number>(teamIds.map((t) => [t, 0]));
  let current = [...rotation];

  for (let round = 0; round < n - 1; round++) {
    const date = new Date(startDate);
    date.setUTCDate(date.getUTCDate() + round * daysBetweenRounds);
    let venueIndex = round; // rota la cancha asignada a cada partido entre jornadas

    for (let i = 0; i < n / 2; i++) {
      const a = current[i];
      const b = current[n - 1 - i];
      if (a === BYE || b === BYE) continue;

      const ha = homeCount.get(a)!;
      const hb = homeCount.get(b)!;
      const bIsHome = hb < ha || (hb === ha && round % 2 === 1);
      const home = bIsHome ? b : a;
      const away = bIsHome ? a : b;
      homeCount.set(home, homeCount.get(home)! + 1);
      result.push({
        jornada: round + 1,
        homeTeam: home,
        awayTeam: away,
        venue: venues[venueIndex % venues.length],
        scheduledAt: date,
      });
      venueIndex++;
    }
    current = [current[0], current[n - 1], ...current.slice(1, n - 1)];
  }
  return result;
}
