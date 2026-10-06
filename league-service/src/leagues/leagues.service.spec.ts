import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LeaguesService } from './leagues.service';

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
});
