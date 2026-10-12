import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { LeaguesService } from './leagues.service';
import { userIdOf } from './leagues.controller';

// Quien hace la peticion: un organizador cualquiera o el administrador de la plataforma
const as = (id: number) => ({ id, admin: false });
const ADMIN = { id: 1, admin: true };


function build(league: any = { id: 1, name: 'Liga', sport: 'futbol', ownerId: null }, calendar: any[] = []) {
  const prisma: any = {
    league: {
      create: jest.fn(({ data }) => ({ id: 1, ...data })),
      findUnique: jest.fn().mockResolvedValue(league),
      findMany: jest.fn().mockResolvedValue(league ? [league] : []),
      update: jest.fn(({ data }) => ({ ...league, ...data })),
    },
    season: { create: jest.fn(({ data }) => ({ id: 1, ...data })) },
  };
  const fixtures: any = { matchesOf: jest.fn().mockResolvedValue(calendar) };
  return { service: new LeaguesService(prisma, fixtures), prisma, fixtures };
}

// Liga del organizador 7 con una temporada
const mine = (extra: any = {}) => ({ id: 1, name: 'Liga Barrial', sport: 'futbol', ownerId: 7, seasons: [{ id: 3, year: 2026 }], ...extra });

describe('LeaguesService', () => {
  it('crea una temporada dentro de la liga', async () => {
    const { service } = build();
    const s = await service.createSeason(1, { year: 2026, startDate: '2026-10-01', endDate: '2027-02-28' }, ADMIN);
    expect(s.leagueId).toBe(1);
  });

  it('rechaza una temporada cuyo inicio no es anterior al fin (restriccion 3.2)', async () => {
    const { service } = build();
    await expect(
      service.createSeason(1, { year: 2026, startDate: '2027-02-28', endDate: '2026-10-01' }, ADMIN),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('responde 404 si la liga no existe', async () => {
    const { service } = build(null);
    await expect(
      service.createSeason(9, { year: 2026, startDate: '2026-10-01', endDate: '2027-02-28' }, ADMIN),
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
    await expect(service.createSeason(1, { year: 2030, startDate: '2026-10-01', endDate: '2027-02-28' }, ADMIN)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.createSeason(1, { year: 2027, startDate: '2026-10-01', endDate: '2027-02-28' }, ADMIN)).resolves.toMatchObject({
      year: 2027,
    });
  });

  describe('propietario de la liga', () => {
    it('otro organizador no puede crear temporadas en una liga ajena (403)', async () => {
      const { service, prisma } = build(mine());
      await expect(service.createSeason(1, { year: 2026, startDate: '2026-10-01', endDate: '2027-02-28' }, as(8))).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.season.create).not.toHaveBeenCalled();
      await service.createSeason(1, { year: 2026, startDate: '2026-10-01', endDate: '2027-02-28' }, as(7));
      expect(prisma.season.create).toHaveBeenCalledTimes(1);
    });

    it('en una liga sin propietario solo el administrador crea temporadas', async () => {
      const { service } = build({ id: 2, name: 'Liga Municipal', sport: 'futbol', ownerId: null });
      await expect(service.createSeason(2, { year: 2026, startDate: '2026-10-01', endDate: '2027-02-28' }, as(7))).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('el administrador asigna el propietario de una liga que no lo tiene', async () => {
      const { service, prisma } = build({ id: 2, name: 'Liga Municipal', sport: 'futbol', ownerId: null, seasons: [], categories: [] });
      await service.assignOwner(2, 7, ADMIN);
      expect(prisma.league.update).toHaveBeenCalledWith({ where: { id: 2 }, data: { ownerId: 7 } });
    });

    it('solo el administrador asigna propietarios (403) y no reasigna una liga con propietario (409)', async () => {
      const legacy = build({ id: 2, name: 'Liga Municipal', sport: 'futbol', ownerId: null });
      await expect(legacy.service.assignOwner(2, 7, as(7))).rejects.toBeInstanceOf(ForbiddenException);
      const owned = build(mine());
      await expect(owned.service.assignOwner(1, 8, ADMIN)).rejects.toBeInstanceOf(ConflictException);
      expect(owned.prisma.league.update).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /leagues/{id} (corregir la liga)', () => {
    it('solo el organizador que la creo puede editarla (403)', async () => {
      const { service, prisma } = build(mine());
      await expect(service.update(1, { name: 'Otra' }, as(8))).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.league.update).not.toHaveBeenCalled();
    });

    it('cambia el nombre si no repite otra liga del organizador', async () => {
      const { service, prisma } = build(mine());
      prisma.league.findMany.mockResolvedValue([{ id: 1, name: 'Liga Barrial' }, { id: 2, name: 'Liga UCC' }]);
      await service.update(1, { name: 'Liga Barrial del Sinú' }, as(7));
      expect(prisma.league.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { name: 'Liga Barrial del Sinú' } });
    });

    it('avisa (409) si el nombre nuevo repite otra liga del organizador, salvo confirmDuplicate', async () => {
      const { service, prisma } = build(mine());
      prisma.league.findMany.mockResolvedValue([{ id: 1, name: 'Liga Barrial' }, { id: 2, name: 'Liga UCC' }]);
      await expect(service.update(1, { name: 'liga ucc' }, as(7))).rejects.toBeInstanceOf(ConflictException);
      await service.update(1, { name: 'Liga UCC', confirmDuplicate: true }, as(7));
      expect(prisma.league.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { name: 'Liga UCC' } });
    });

    it('corregir mayusculas o tildes del mismo nombre no cuenta como repetido', async () => {
      const { service, prisma } = build(mine());
      await service.update(1, { name: 'LIGA BARRIAL' }, as(7));
      expect(prisma.league.findMany).not.toHaveBeenCalled();
      expect(prisma.league.update).toHaveBeenCalled();
    });

    it('no cambia el deporte si una temporada ya tiene calendario (409)', async () => {
      const { service, prisma, fixtures } = build(mine(), [{ id: 50, scheduledAt: '2026-10-17T20:00:00.000Z' }]);
      await expect(service.update(1, { sport: 'voley' }, as(7))).rejects.toBeInstanceOf(ConflictException);
      expect(fixtures.matchesOf).toHaveBeenCalledWith(3);
      expect(prisma.league.update).not.toHaveBeenCalled();
    });

    it('cambia el deporte mientras no haya calendario', async () => {
      const { service, prisma } = build(mine(), []);
      await service.update(1, { sport: 'voley' }, as(7));
      expect(prisma.league.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { sport: 'voley' } });
    });

    it('si el Fixture Service no responde, no cambia el deporte a ciegas (503)', async () => {
      const { service, prisma, fixtures } = build(mine());
      fixtures.matchesOf.mockRejectedValue(new ServiceUnavailableException('sin Fixture'));
      await expect(service.update(1, { sport: 'basquet' }, as(7))).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(prisma.league.update).not.toHaveBeenCalled();
    });

    it('sin cambios no escribe nada', async () => {
      const { service, prisma } = build(mine());
      await service.update(1, { name: 'Liga Barrial', sport: 'futbol' }, as(7));
      expect(prisma.league.update).not.toHaveBeenCalled();
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
