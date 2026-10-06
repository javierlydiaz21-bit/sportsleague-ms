import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { LiveService, scoreOf } from './live.service';

const liveMatch = (overrides: any = {}) => ({
  matchId: 1,
  seasonId: 1,
  categoryId: 1,
  homeTeam: 10,
  awayTeam: 20,
  status: 'programado',
  suspensionReason: null,
  peakViewers: 0,
  completedAt: null,
  ...overrides,
});

function build(options: { stored?: any; events?: any[]; fixtureMatch?: any; team?: any } = {}) {
  let events = [...(options.events ?? [])];
  let nextId = 100;
  const prisma: any = {
    liveMatch: {
      findUnique: jest.fn().mockResolvedValue('stored' in options ? options.stored : liveMatch()),
      upsert: jest.fn(({ create }) => ({ ...liveMatch(), ...create })),
      update: jest.fn(({ where, data }) => ({ ...liveMatch({ matchId: where.matchId }), ...data })),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    matchEvent: {
      create: jest.fn(({ data }) => {
        const e = { id: nextId++, ...data };
        events.push(e);
        return e;
      }),
      findMany: jest.fn(async () => events),
      findFirst: jest.fn(async ({ where }) => events.find((e) => e.id === where.id && e.matchId === where.matchId) ?? null),
      delete: jest.fn(async ({ where }) => {
        events = events.filter((e) => e.id !== where.id);
      }),
    },
  };
  const publisher: any = { publish: jest.fn().mockResolvedValue(undefined) };
  const fixture: any = {
    getMatch: jest.fn().mockResolvedValue(options.fixtureMatch ?? null),
    getTeam: jest.fn().mockResolvedValue(options.team ?? null),
  };
  const metrics: any = { matchEvents: { inc: jest.fn() } };
  return { service: new LiveService(prisma, publisher, fixture, metrics), prisma, publisher, fixture, metrics };
}

const published = (publisher: any, type: string) =>
  publisher.publish.mock.calls.filter((c: any[]) => c[0] === type).map((c: any[]) => c[1]);

describe('scoreOf', () => {
  it('cuenta solo los goles de cada equipo', () => {
    const events = [
      { type: 'gol', teamId: 10 },
      { type: 'gol', teamId: 10 },
      { type: 'tarjeta_amarilla', teamId: 20 },
      { type: 'gol', teamId: 20 },
    ];
    expect(scoreOf({ homeTeam: 10, awayTeam: 20 }, events as any)).toEqual({ home: 2, away: 1 });
  });
});

describe('LiveService.registerEvent', () => {
  it('guarda el evento, inicia el partido y publica match.event con el marcador', async () => {
    const { service, prisma, publisher, metrics } = build();
    const r = await service.registerEvent(1, { type: 'gol', minute: 12, teamId: 10, playerId: 7 } as any);
    expect(r.score).toEqual({ home: 1, away: 0 });
    expect(prisma.liveMatch.update).toHaveBeenCalledWith({ where: { matchId: 1 }, data: { status: 'en_curso' } });
    const [event] = published(publisher, 'match.event');
    expect(event).toMatchObject({ matchId: 1, type: 'gol', minute: 12, teamId: 10, playerId: 7, score: { home: 1, away: 0 } });
    expect(typeof event.registeredAt).toBe('string');
    expect(metrics.matchEvents.inc).toHaveBeenCalledWith({ type: 'gol', season: '1', category: '1' });
  });

  it('rechaza un equipo que no juega el partido', async () => {
    const { service, publisher } = build();
    await expect(service.registerEvent(1, { type: 'gol', minute: 5, teamId: 99 } as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(publisher.publish).not.toHaveBeenCalled();
  });

  it('rechaza eventos en un partido suspendido', async () => {
    const { service } = build({ stored: liveMatch({ status: 'suspendido' }) });
    await expect(service.registerEvent(1, { type: 'gol', minute: 5, teamId: 10 } as any)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('en un partido finalizado corrige el acta y reenvia match.completed', async () => {
    const { service, publisher } = build({ stored: liveMatch({ status: 'finalizado', completedAt: new Date() }) });
    const r = await service.registerEvent(1, { type: 'gol', minute: 80, teamId: 20 } as any);
    expect(r.correction).toBe(true);
    const [acta] = published(publisher, 'match.completed');
    expect(acta).toMatchObject({ correction: true, homeGoals: 0, awayGoals: 1 });
  });
});

describe('LiveService.ensureMatch (respaldo REST si fixture.published no llego)', () => {
  it('consulta el partido al Fixture Service y la categoria al Team Service', async () => {
    const { service, prisma, fixture } = build({
      stored: null,
      fixtureMatch: { id: 1, seasonId: 3, homeTeam: 10, awayTeam: 20, status: 'programado' },
      team: { id: 10, name: 'Halcones', categoryId: 5 },
    });
    const m = await service.ensureMatch(1);
    expect(fixture.getMatch).toHaveBeenCalledWith(1);
    expect(fixture.getTeam).toHaveBeenCalledWith(10);
    expect(prisma.liveMatch.upsert.mock.calls[0][0].create).toMatchObject({ seasonId: 3, categoryId: 5, homeTeam: 10 });
    expect(m.categoryId).toBe(5);
  });

  it('responde 404 si el partido no existe en el Fixture Service', async () => {
    const { service } = build({ stored: null });
    await expect(service.ensureMatch(9)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('LiveService.complete', () => {
  it('cierra el partido y publica match.completed con el acta', async () => {
    const events = [
      { id: 1, matchId: 1, type: 'gol', minute: 10, teamId: 10, playerId: 7 },
      { id: 2, matchId: 1, type: 'tarjeta_roja', minute: 50, teamId: 20, playerId: 8 },
    ];
    const { service, prisma, publisher } = build({ stored: liveMatch({ status: 'en_curso' }), events });
    const r = await service.complete(1);
    expect(prisma.liveMatch.update.mock.calls[0][0].data.status).toBe('finalizado');
    expect(r.resent).toBe(false);
    const [acta] = published(publisher, 'match.completed');
    expect(acta).toMatchObject({ matchId: 1, seasonId: 1, categoryId: 1, homeGoals: 1, awayGoals: 0, correction: false });
    expect(acta.events).toHaveLength(2);
  });

  it('si ya estaba finalizado reenvia el acta sin volver a cerrarlo (idempotente)', async () => {
    const { service, prisma, publisher } = build({ stored: liveMatch({ status: 'finalizado', completedAt: new Date() }) });
    const r = await service.complete(1);
    expect(r.resent).toBe(true);
    expect(prisma.liveMatch.update).not.toHaveBeenCalled();
    expect(published(publisher, 'match.completed')).toHaveLength(1);
  });

  it('no cierra un partido suspendido', async () => {
    const { service } = build({ stored: liveMatch({ status: 'suspendido' }) });
    await expect(service.complete(1)).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('LiveService.annulEvent y suspend', () => {
  it('anula un evento y publica el marcador corregido', async () => {
    const events = [{ id: 1, matchId: 1, type: 'gol', minute: 10, teamId: 10, playerId: null }];
    const { service, publisher } = build({ stored: liveMatch({ status: 'en_curso' }), events });
    const r = await service.annulEvent(1, 1);
    expect(r.score).toEqual({ home: 0, away: 0 });
    expect(published(publisher, 'match.event_annulled')[0]).toMatchObject({ eventId: 1, score: { home: 0, away: 0 } });
  });

  it('responde 404 si el evento no es de ese partido', async () => {
    const { service } = build({ events: [{ id: 1, matchId: 2, type: 'gol', minute: 1, teamId: 10 }] });
    await expect(service.annulEvent(1, 1)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('suspende el partido con su motivo y publica match.suspended', async () => {
    const { service, publisher } = build({ stored: liveMatch({ status: 'en_curso' }) });
    const r = await service.suspend(1, 'Tormenta electrica');
    expect(r.status).toBe('suspendido');
    expect(published(publisher, 'match.suspended')[0]).toMatchObject({ matchId: 1, reason: 'Tormenta electrica' });
  });

  it('no suspende un partido finalizado', async () => {
    const { service } = build({ stored: liveMatch({ status: 'finalizado' }) });
    await expect(service.suspend(1, 'x')).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('LiveService.syncFromFixture (consumo de fixture.published)', () => {
  it('guarda una copia local de cada partido de la jornada', async () => {
    const { service, prisma } = build();
    await service.syncFromFixture({
      seasonId: 1,
      categoryId: 2,
      matches: [
        { matchId: 1, homeTeam: 10, awayTeam: 20 },
        { matchId: 2, homeTeam: 30, awayTeam: 40 },
      ],
    });
    expect(prisma.liveMatch.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.liveMatch.upsert.mock.calls[1][0].create).toEqual({
      matchId: 2,
      seasonId: 1,
      categoryId: 2,
      homeTeam: 30,
      awayTeam: 40,
    });
  });
});
