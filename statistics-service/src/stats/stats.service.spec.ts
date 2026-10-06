import { BadRequestException } from '@nestjs/common';
import { StatsService } from './stats.service';

/** Base de datos en memoria con lo minimo que usa el servicio. */
function build(options: { rules?: any } = {}) {
  const db = {
    results: new Map<number, any>(),
    events: [] as any[],
    standings: new Map<string, any>(),
    scorers: [] as any[],
    discipline: new Map<number, any>(),
  };
  const groupCount = (rows: any[], keys: string[]) => {
    const groups = new Map<string, any>();
    for (const r of rows) {
      const k = keys.map((key) => r[key]).join('|');
      const g = groups.get(k) ?? { ...Object.fromEntries(keys.map((key) => [key, r[key]])), _count: { _all: 0 } };
      g._count._all++;
      groups.set(k, g);
    }
    return [...groups.values()];
  };

  const prisma: any = {
    $transaction: jest.fn(async (ops: any[]) => {
      const out: any[] = [];
      for (const op of ops) out.push(await (typeof op === 'function' ? op() : op));
      return out;
    }),
    matchResult: {
      upsert: jest.fn(async ({ where, create, update }) => {
        const prev = db.results.get(where.matchId);
        db.results.set(where.matchId, prev ? { ...prev, ...update } : { homePoints: null, awayPoints: null, ...create });
      }),
      findMany: jest.fn(async ({ where }) => [...db.results.values()].filter((r) => r.seasonId === where.seasonId)),
      findFirst: jest.fn(async ({ where }) => [...db.results.values()].find((r) => r.seasonId === where.seasonId) ?? null),
      update: jest.fn(async ({ where, data }) => Object.assign(db.results.get(where.matchId), data)),
    },
    matchResultEvent: {
      findMany: jest.fn(async ({ where }) => db.events.filter((e) => e.matchId === where.matchId)),
      deleteMany: jest.fn(async ({ where }) => {
        db.events = db.events.filter((e) => e.matchId !== where.matchId);
      }),
      createMany: jest.fn(async ({ data }) => {
        db.events.push(...data);
      }),
      groupBy: jest.fn(async ({ by, where }) => {
        let rows = db.events;
        if (where.type === 'gol') rows = rows.filter((e) => e.type === 'gol' && e.playerId !== null && where.matchId.in.includes(e.matchId));
        else rows = rows.filter((e) => where.playerId.in.includes(e.playerId) && where.type.in.includes(e.type));
        return groupCount(rows, by);
      }),
    },
    standing: {
      findMany: jest.fn(async ({ where }) => [...db.standings.values()].filter((s) => s.seasonId === where.seasonId)),
      upsert: jest.fn(async ({ where, create, update }) => {
        const k = `${where.seasonId_teamId.seasonId}-${where.seasonId_teamId.teamId}`;
        const prev = db.standings.get(k);
        db.standings.set(k, prev ? { ...prev, ...update } : create);
      }),
    },
    topScorer: {
      deleteMany: jest.fn(async ({ where }) => {
        db.scorers = db.scorers.filter((s) => s.seasonId !== where.seasonId);
      }),
      createMany: jest.fn(async ({ data }) => {
        db.scorers.push(...data);
      }),
    },
    disciplinaryRecord: {
      upsert: jest.fn(async ({ where, create, update }) => {
        db.discipline.set(where.playerId, db.discipline.has(where.playerId) ? { ...db.discipline.get(where.playerId), ...update } : create);
      }),
      findUnique: jest.fn(async ({ where }) => db.discipline.get(where.playerId) ?? null),
    },
  };
  const league: any = {
    getRules: jest.fn().mockResolvedValue(
      'rules' in options ? options.rules : { categoryId: 1, pointsWin: 3, pointsDraw: 1, tiebreakerCriteria: 'diferencia_de_goles' },
    ),
  };
  const cache: any = { get: jest.fn().mockResolvedValue(null), set: jest.fn(), invalidate: jest.fn() };
  return { service: new StatsService(prisma, league, cache), db, league, cache };
}

const acta = (overrides: any = {}) => ({
  matchId: 1,
  seasonId: 1,
  categoryId: 1,
  homeTeam: 10,
  awayTeam: 20,
  homeGoals: 2,
  awayGoals: 1,
  completedAt: '2026-10-03T18:00:00.000Z',
  events: [
    { type: 'gol', minute: 10, teamId: 10, playerId: 1 },
    { type: 'gol', minute: 30, teamId: 10, playerId: 1 },
    { type: 'gol', minute: 50, teamId: 20, playerId: 2 },
    { type: 'tarjeta_amarilla', minute: 60, teamId: 20, playerId: 3 },
  ],
  ...overrides,
});

describe('StatsService.processMatchCompleted (consumo de match.completed)', () => {
  it('actualiza posiciones, goleadores y tarjetas con el reglamento del League Service', async () => {
    const { service, db, league, cache } = build();
    await service.processMatchCompleted(acta());
    expect(league.getRules).toHaveBeenCalledWith(1);
    expect(db.standings.get('1-10')).toMatchObject({ points: 3, wins: 1, goalsFor: 2, goalDifference: 1 });
    expect(db.standings.get('1-20')).toMatchObject({ points: 0, losses: 1 });
    expect(db.scorers).toEqual(
      expect.arrayContaining([
        { seasonId: 1, playerId: 1, goals: 2 },
        { seasonId: 1, playerId: 2, goals: 1 },
      ]),
    );
    expect(db.discipline.get(3)).toMatchObject({ yellowCards: 1, redCards: 0 });
    expect(cache.invalidate).toHaveBeenCalledWith(1);
  });

  it('es idempotente: la misma acta dos veces no duplica puntos ni goles', async () => {
    const { service, db } = build();
    await service.processMatchCompleted(acta());
    await service.processMatchCompleted(acta());
    expect(db.standings.get('1-10')).toMatchObject({ points: 3, wins: 1, goalsFor: 2 });
    expect(db.scorers.find((s) => s.playerId === 1).goals).toBe(2);
    expect(db.discipline.get(3).yellowCards).toBe(1);
  });

  it('un acta corregida reemplaza a la anterior (gol anulado tras el cierre)', async () => {
    const { service, db } = build();
    await service.processMatchCompleted(acta());
    await service.processMatchCompleted(
      acta({
        homeGoals: 1,
        awayGoals: 1,
        correction: true,
        events: [
          { type: 'gol', minute: 10, teamId: 10, playerId: 1 },
          { type: 'gol', minute: 50, teamId: 20, playerId: 2 },
        ],
      }),
    );
    expect(db.standings.get('1-10')).toMatchObject({ points: 1, draws: 1, wins: 0 });
    expect(db.scorers.find((s) => s.playerId === 1).goals).toBe(1);
    // la amarilla del jugador 3 desaparecio del acta corregida
    expect(db.discipline.get(3).yellowCards).toBe(0);
  });

  it('si la categoria no tiene reglamento, el acta queda guardada y se informa el error', async () => {
    const { service, db } = build({ rules: null });
    await expect(service.processMatchCompleted(acta())).rejects.toBeInstanceOf(BadRequestException);
    expect(db.results.has(1)).toBe(true);
  });
});

describe('StatsService lecturas', () => {
  it('la tabla sale ordenada, con posicion y partidos jugados', async () => {
    const { service } = build();
    await service.registerSeasonTeams(1, [10, 20, 30]);
    await service.processMatchCompleted(acta());
    const t = await service.getStandings(1);
    expect(t.standings.map((s: any) => s.teamId)).toEqual([10, 30, 20]);
    expect(t.standings[0]).toMatchObject({ position: 1, played: 1, points: 3 });
    expect(t.tiebreakerCriteria).toBe('diferencia_de_goles');
  });

  it('usa la cache de Redis si la tabla ya esta calculada', async () => {
    const { service, cache } = build();
    cache.get.mockResolvedValue({ seasonId: 1, standings: [] });
    const t = await service.getStandings(1);
    expect(t.cached).toBe(true);
  });

  it('un jugador sin tarjetas tiene un registro en cero', async () => {
    const { service } = build();
    expect(await service.getDisciplinaryRecord(99)).toEqual({ playerId: 99, yellowCards: 0, redCards: 0 });
  });
});
