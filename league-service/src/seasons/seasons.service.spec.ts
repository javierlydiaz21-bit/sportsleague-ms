import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { SeasonsService } from './seasons.service';

function build(season: any = { id: 3, leagueId: 7 }, existing: string[] = [], calendar: any[] = []) {
  const prisma: any = {
    season: {
      findUnique: jest.fn().mockResolvedValue(season),
      update: jest.fn(({ data }) => ({ ...season, ...data })),
    },
    category: {
      create: jest.fn(({ data }) => ({ id: 1, ...data })),
      findMany: jest.fn().mockResolvedValue(existing.map((name) => ({ name }))),
    },
  };
  const fixtures: any = { matchesOf: jest.fn().mockResolvedValue(calendar) };
  return { service: new SeasonsService(prisma, fixtures), prisma, fixtures };
}

// Temporada 2026 (17 oct 2026 a 20 mar 2027) de una liga del organizador 7, con dos partidos
const season2026 = {
  id: 3,
  leagueId: 7,
  year: 2026,
  startDate: new Date('2026-10-17T00:00:00Z'),
  endDate: new Date('2027-03-20T00:00:00Z'),
  league: { id: 7, ownerId: 7 },
};
const calendar = [
  { id: 1, scheduledAt: '2026-10-17T20:00:00.000Z' },
  { id: 2, scheduledAt: '2026-11-07T20:00:00.000Z' },
];

describe('SeasonsService.update (PATCH /seasons/{id})', () => {
  it('rechaza (409) fechas que dejarian partidos fuera de la temporada, sin cambiar nada', async () => {
    const { service, prisma } = build(season2026, [], calendar);
    await expect(service.update(3, { startDate: '2026-10-24' }, 7)).rejects.toBeInstanceOf(ConflictException);
    await expect(service.update(3, { endDate: '2026-11-01' }, 7)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.season.update).not.toHaveBeenCalled();
  });

  it('acepta fechas que siguen cubriendo todo el calendario (el partido del ultimo dia cuenta)', async () => {
    const { service, prisma } = build(season2026, [], calendar);
    await service.update(3, { startDate: '2026-10-17', endDate: '2026-11-07' }, 7);
    expect(prisma.season.update).toHaveBeenCalled();
  });

  it('sin cambio de fechas no consulta el calendario', async () => {
    const { service, fixtures, prisma } = build(season2026, [], calendar);
    await service.update(3, { year: 2027 }, 7);
    expect(fixtures.matchesOf).not.toHaveBeenCalled();
    expect(prisma.season.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ year: 2027 }) }));
  });

  it('valida el año contra las fechas resultantes y el orden de las fechas', async () => {
    const { service } = build(season2026);
    await expect(service.update(3, { year: 2030 }, 7)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.update(3, { endDate: '2026-10-01' }, 7)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('solo el organizador de la liga puede editar su temporada (403)', async () => {
    const { service } = build(season2026);
    await expect(service.update(3, { year: 2027 }, 99)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('responde 404 si la temporada no existe', async () => {
    const { service } = build(null);
    await expect(service.update(9, { year: 2027 }, 7)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('SeasonsService.createCategory', () => {
  it('guarda la categoria con el league_id de la temporada', async () => {
    const { service } = build();
    const c = await service.createCategory(3, { name: 'Sub-17', ageRange: '15-17' });
    expect(c).toMatchObject({ leagueId: 7, name: 'Sub-17', ageRange: '15-17' });
  });

  it('rechaza un age_range con minimo mayor que maximo', async () => {
    const { service } = build();
    await expect(service.createCategory(3, { name: 'X', ageRange: '18-15' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('responde 404 si la temporada no existe', async () => {
    const { service } = build(null);
    await expect(service.createCategory(9, { name: 'Sub-17', ageRange: '15-17' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rechaza una categoria con el mismo nombre en la liga (sin distinguir mayusculas ni tildes)', async () => {
    const { service, prisma } = build({ id: 3, leagueId: 7 }, ['Sub-17', 'Júnior']);
    await expect(service.createCategory(3, { name: 'sub-17', ageRange: '15-17' })).rejects.toBeInstanceOf(ConflictException);
    await expect(service.createCategory(3, { name: 'JUNIOR', ageRange: '15-17' })).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.category.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { leagueId: 7 } }));
    await expect(service.createCategory(3, { name: 'Sub-15', ageRange: '13-15' })).resolves.toMatchObject({ name: 'Sub-15' });
  });

  it('rechaza edades menores de 3 anios', async () => {
    const { service } = build();
    await expect(service.createCategory(3, { name: 'Baby', ageRange: '1-4' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
