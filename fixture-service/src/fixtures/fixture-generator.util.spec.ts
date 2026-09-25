import { BadRequestException } from '@nestjs/common';
import { generateRoundRobin } from './fixture-generator.util';

const venues = ['Cancha 1', 'Cancha 2', 'Cancha 3', 'Cancha 4'];
const start = new Date('2026-10-03');

describe('generateRoundRobin (calendario todos contra todos)', () => {
  it.each([4, 5, 6, 8])('con %i equipos cada pareja juega exactamente una vez', (n) => {
    const teams = Array.from({ length: n }, (_, i) => i + 1);
    const matches = generateRoundRobin(teams, venues, start, 7, 3);
    const pairs = matches.map((m) => [m.homeTeam, m.awayTeam].sort().join('-'));
    expect(new Set(pairs).size).toBe((n * (n - 1)) / 2);
    expect(pairs.length).toBe((n * (n - 1)) / 2);
  });

  it('ningun equipo juega contra si mismo', () => {
    const matches = generateRoundRobin([1, 2, 3, 4, 5], venues, start, 7, 3);
    expect(matches.every((m) => m.homeTeam !== m.awayTeam)).toBe(true);
  });

  it('cada equipo juega como maximo una vez por jornada (descanso minimo)', () => {
    const matches = generateRoundRobin([1, 2, 3, 4, 5, 6], venues, start, 7, 3);
    for (const jornada of new Set(matches.map((m) => m.jornada))) {
      const teams = matches.filter((m) => m.jornada === jornada).flatMap((m) => [m.homeTeam, m.awayTeam]);
      expect(new Set(teams).size).toBe(teams.length);
    }
  });

  it('las jornadas se separan daysBetweenRounds dias', () => {
    const matches = generateRoundRobin([1, 2, 3, 4], venues, start, 7, 3);
    const dates = [...new Set(matches.map((m) => m.scheduledAt.toISOString()))].sort();
    expect(dates).toEqual(['2026-10-03', '2026-10-10', '2026-10-17'].map((d) => new Date(d).toISOString()));
  });

  it('dos partidos de la misma jornada nunca comparten cancha', () => {
    const matches = generateRoundRobin([1, 2, 3, 4, 5, 6, 7, 8], venues, start, 7, 3);
    for (const jornada of new Set(matches.map((m) => m.jornada))) {
      const used = matches.filter((m) => m.jornada === jornada).map((m) => m.venue);
      expect(new Set(used).size).toBe(used.length);
    }
  });

  it.each([4, 5, 6, 8])('con %i equipos la diferencia de partidos de local es como maximo 1', (n) => {
    const teams = Array.from({ length: n }, (_, i) => i + 1);
    const matches = generateRoundRobin(teams, venues, start, 7, 3);
    const home = teams.map((t) => matches.filter((m) => m.homeTeam === t).length);
    expect(Math.max(...home) - Math.min(...home)).toBeLessThanOrEqual(1);
  });

  it('rechaza si las jornadas estan mas cerca que el descanso minimo', () => {
    expect(() => generateRoundRobin([1, 2, 3, 4], venues, start, 2, 3)).toThrow(BadRequestException);
  });

  it('rechaza si no hay canchas suficientes para una jornada', () => {
    expect(() => generateRoundRobin([1, 2, 3, 4, 5, 6], ['Cancha 1'], start, 7, 3)).toThrow(BadRequestException);
  });
});
