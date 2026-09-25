import { BadRequestException, ConflictException } from '@nestjs/common';
import { FixturesService } from './fixtures.service';

function build(options: { existing?: number; rules?: any; teams?: Record<number, any> } = {}) {
  let nextId = 1;
  const prisma: any = {
    match: {
      count: jest.fn().mockResolvedValue(options.existing ?? 0),
      create: jest.fn(({ data }) => ({ id: nextId++, status: 'programado', ...data })),
    },
    $transaction: jest.fn((ops: any[]) => Promise.all(ops)),
  };
  const publisher: any = { publishFixturePublished: jest.fn().mockResolvedValue(undefined) };
  const league: any = {
    getRules: jest.fn().mockResolvedValue(
      'rules' in options ? options.rules : { id: 1, categoryId: 1, pointsWin: 3, pointsDraw: 1, tiebreakerCriteria: 'dg' },
    ),
  };
  const teams = options.teams ?? { 1: 1, 2: 1, 3: 1, 4: 1 };
  const team: any = {
    getTeam: jest.fn(async (id: number) => (id in teams ? { id, name: `Equipo ${id}`, categoryId: teams[id] } : null)),
  };
  const service = new FixturesService(prisma, publisher, league, team);
  return { service, prisma, publisher, league, team };
}

const dto = {
  categoryId: 1,
  zone: 'monteria-norte',
  teamIds: [1, 2, 3, 4],
  venues: ['Cancha 1', 'Cancha 2'],
  startDate: '2026-10-03',
};

describe('FixturesService.generate', () => {
  it('consulta el reglamento (League) y valida cada equipo (Team) de forma sincrona', async () => {
    const { service, league, team } = build();
    const result = await service.generate(1, dto);
    expect(league.getRules).toHaveBeenCalledWith(1);
    expect(team.getTeam).toHaveBeenCalledTimes(4);
    expect(result.totalMatches).toBe(6);
    expect(result.reglamento.pointsWin).toBe(3);
    expect(result.equiposValidados).toHaveLength(4);
  });

  it('publica fixture.published una vez por cada jornada', async () => {
    const { service, publisher } = build();
    await service.generate(1, dto);
    expect(publisher.publishFixturePublished).toHaveBeenCalledTimes(3);
    const jornadas = publisher.publishFixturePublished.mock.calls.map((c: any[]) => c[0].jornada);
    expect(jornadas).toEqual([1, 2, 3]);
    for (const [payload] of publisher.publishFixturePublished.mock.calls) {
      expect(payload.matches).toHaveLength(2);
      expect(payload).toMatchObject({ seasonId: 1, categoryId: 1, zone: 'monteria-norte' });
    }
  });

  it('rechaza con 409 si la temporada ya tiene calendario', async () => {
    const { service, league } = build({ existing: 6 });
    await expect(service.generate(1, dto)).rejects.toBeInstanceOf(ConflictException);
    expect(league.getRules).not.toHaveBeenCalled();
  });

  it('rechaza si la categoria no tiene reglamento en el League Service', async () => {
    const { service, publisher } = build({ rules: null });
    await expect(service.generate(1, dto)).rejects.toBeInstanceOf(BadRequestException);
    expect(publisher.publishFixturePublished).not.toHaveBeenCalled();
  });

  it('rechaza si un equipo no existe en el Team Service', async () => {
    const { service, prisma } = build({ teams: { 1: 1, 2: 1, 3: 1 } });
    await expect(service.generate(1, dto)).rejects.toThrow('El equipo 4 no existe');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rechaza si un equipo pertenece a otra categoria', async () => {
    const { service } = build({ teams: { 1: 1, 2: 1, 3: 2, 4: 1 } });
    await expect(service.generate(1, dto)).rejects.toThrow('pertenece a la categoria 2');
  });
});
