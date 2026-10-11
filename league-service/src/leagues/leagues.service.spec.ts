import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { LeaguesService } from './leagues.service';
import { userIdOf } from './leagues.controller';

function build(league: any = { id: 1, name: 'Liga', sport: 'futbol' }) {
  const prisma: any = {
    league: {
      create: jest.fn(({ data }) => ({ id: 1, ...data })),
      findUnique: jest.fn().mockResolvedValue(league),
      findMany: jest.fn().mockResolvedValue(league ? [league] : []),
    },
    season: { create: jest.fn(({ data }) => ({ id: 1, ...data })) },
  };
  return { service: new LeaguesService(prisma), prisma };
}

describe('LeaguesService', () => {
  it('crea una temporada dentro de la liga', async () => {
    const { service } = build();
    const s = await service.createSeason(1, { year: 2026, startDate: '2026-10-01', endDate: '2027-02-28' });
    expect(s.leagueId).toBe(1);
  });

  it('rechaza una temporada cuyo inicio no es anterior al fin (restriccion 3.2)', async () => {
    const { service } = build();
    await expect(
      service.createSeason(1, { year: 2026, startDate: '2027-02-28', endDate: '2026-10-01' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('responde 404 si la liga no existe', async () => {
    const { service } = build(null);
    await expect(
      service.createSeason(9, { year: 2026, startDate: '2026-10-01', endDate: '2027-02-28' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lista las ligas incluyendo temporadas y categorias con su reglamento', async () => {
    const { service, prisma } = build();
    await service.findAll();
    expect(prisma.league.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ include: expect.objectContaining({ seasons: expect.anything(), categories: expect.anything() }) }),
    );
  });

  it('GET /leagues/{id} responde 404 si la liga no existe', async () => {
    const { service } = build(null);
    await expect(service.findOne(9)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('guarda como propietario al usuario que crea la liga', async () => {
    const { service, prisma } = build();
    const l = await service.create({ name: 'Liga Nueva', sport: 'futbol' }, 7);
    expect(prisma.league.create).toHaveBeenCalledWith({ data: { name: 'Liga Nueva', sport: 'futbol', ownerId: 7 } });
    expect(l.ownerId).toBe(7);
  });

  it('sin usuario la liga queda sin propietario (compatible con llamadas anteriores)', async () => {
    const { service, prisma } = build();
    await service.create({ name: 'Liga', sport: 'voley' });
    expect(prisma.league.create).toHaveBeenCalledWith({ data: { name: 'Liga', sport: 'voley', ownerId: null } });
  });

  it('"Mis ligas" filtra por propietario: las ligas sin propietario no aparecen', async () => {
    const { service, prisma } = build();
    await service.findMine(7);
    expect(prisma.league.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { ownerId: 7 } }));
  });

  it('avisa (409) si el mismo organizador repite el nombre de una de sus ligas', async () => {
    const { service, prisma } = build({ id: 1, name: 'Liga Barrial de Montería', sport: 'futbol' });
    await expect(service.create({ name: 'liga barrial de monteria', sport: 'voley' }, 7)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.league.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { ownerId: 7 } }));
    expect(prisma.league.create).not.toHaveBeenCalled();
  });

  it('con confirmDuplicate crea la liga aunque el nombre se repita (y no lo guarda como dato)', async () => {
    const { service, prisma } = build({ id: 1, name: 'Liga UCC', sport: 'voley' });
    await service.create({ name: 'Liga UCC', sport: 'voley', confirmDuplicate: true }, 7);
    expect(prisma.league.create).toHaveBeenCalledWith({ data: { name: 'Liga UCC', sport: 'voley', ownerId: 7 } });
  });

  it('rechaza una temporada cuyo año no corresponde a sus fechas', async () => {
    const { service } = build();
    await expect(service.createSeason(1, { year: 2030, startDate: '2026-10-01', endDate: '2027-02-28' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.createSeason(1, { year: 2027, startDate: '2026-10-01', endDate: '2027-02-28' })).resolves.toMatchObject({
      year: 2027,
    });
  });

  it('solo acepta como usuario un entero positivo en x-user-id', () => {
    expect(userIdOf('12')).toBe(12);
    expect(userIdOf(undefined)).toBeNull();
    expect(userIdOf('abc')).toBeNull();
    expect(userIdOf('0')).toBeNull();
    expect(userIdOf('-3')).toBeNull();
    expect(userIdOf('1.5')).toBeNull();
  });

  it('"Mis ligas" sin usuario responde 400 en vez de listar todas', async () => {
    const { service, prisma } = build();
    expect(() => service.findMine(null)).toThrow(BadRequestException);
    expect(prisma.league.findMany).not.toHaveBeenCalled();
  });
});
