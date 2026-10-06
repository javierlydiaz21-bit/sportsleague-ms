import { NotificationsService } from './notifications.service';

function build(followers: any[] = []) {
  const store = new Map<string, any>();
  let nextId = 1;
  const prisma: any = {
    notification: {
      upsert: jest.fn(async ({ where, create, update }) => {
        const prev = store.get(where.key);
        const row = prev ? { ...prev, ...update } : { id: nextId++, ...create };
        store.set(where.key, row);
        return row;
      }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    notificationPreference: {
      findMany: jest.fn().mockResolvedValue(followers),
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn(({ create }) => create),
    },
  };
  const teams: any = { teamName: jest.fn(async (id: number) => ({ 1: 'Halcones FC', 2: 'Tigres United' })[id] ?? `Equipo ${id}`) };
  return { service: new NotificationsService(prisma, teams), prisma, store };
}

describe('NotificationsService (consumo de eventos)', () => {
  it('fixture.published: un aviso de horario por partido, con nombres de equipos', async () => {
    const { service, store } = build();
    await service.onFixturePublished({
      jornada: 1,
      matches: [
        { matchId: 1, homeTeam: 1, awayTeam: 2, venue: 'Cancha 1', scheduledAt: '2026-10-03T00:00:00.000Z' },
        { matchId: 2, homeTeam: 3, awayTeam: 4, venue: 'Cancha 2', scheduledAt: '2026-10-03T00:00:00.000Z' },
      ],
    });
    expect(store.size).toBe(2);
    expect(store.get('horario:1').body).toBe('Halcones FC vs Tigres United: sabado 2026-10-03 en Cancha 1.');
    expect(store.get('horario:1').teamIds).toEqual([1, 2]);
  });

  it('match.completed: resultado final; el acta corregida actualiza el mismo aviso', async () => {
    const { service, store } = build();
    const acta = { matchId: 5, homeTeam: 1, awayTeam: 2, homeGoals: 2, awayGoals: 1 };
    await service.onMatchCompleted(acta);
    await service.onMatchCompleted({ ...acta, homeGoals: 1, correction: true });
    expect(store.size).toBe(1);
    expect(store.get('resultado:5')).toMatchObject({
      title: 'Resultado final (acta corregida)',
      body: 'Halcones FC 1 - 1 Tigres United.',
    });
  });

  it('fixture.venue_changed avisa la sede nueva y la anterior', async () => {
    const { service, store } = build();
    await service.onVenueChanged({
      matchId: 1,
      homeTeam: 1,
      awayTeam: 2,
      venue: 'Estadio',
      previousVenue: 'Cancha 1',
      scheduledAt: '2026-10-03T00:00:00.000Z',
    });
    expect(store.get('sede:1:Estadio').body).toContain('se juega en Estadio, ya no en Cancha 1');
  });

  it('envia por los canales de los usuarios que siguen a esos equipos', async () => {
    const { service, prisma } = build([{ userId: 7, followedTeams: [1], channels: ['push', 'email'] }]);
    const n = await service.onMatchSuspended({ matchId: 1, homeTeam: 1, awayTeam: 2, reason: 'Lluvia' });
    expect(prisma.notificationPreference.findMany).toHaveBeenCalledWith({ where: { followedTeams: { hasSome: [1, 2] } } });
    expect(n.deliveries).toBe(2);
  });
});

describe('NotificationsService.findForUser', () => {
  it('sin equipos seguidos muestra los avisos generales de la liga', async () => {
    const { service, prisma } = build();
    await service.findForUser(3);
    expect(prisma.notification.findMany.mock.calls[0][0].where).toEqual({ OR: [{ userId: 3 }, { userId: null }] });
  });

  it('con equipos seguidos filtra por esos equipos', async () => {
    const { service, prisma } = build();
    prisma.notificationPreference.findUnique.mockResolvedValue({ userId: 3, followedTeams: [1], channels: ['push'] });
    const r = await service.findForUser(3);
    expect(prisma.notification.findMany.mock.calls[0][0].where).toEqual({ OR: [{ userId: 3 }, { teamIds: { hasSome: [1] } }] });
    expect(r.preferences.followedTeams).toEqual([1]);
  });
});
