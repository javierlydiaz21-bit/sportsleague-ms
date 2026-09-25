import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SeasonsService } from './seasons.service';

function build(season: any = { id: 3, leagueId: 7 }) {
  const prisma: any = {
    season: { findUnique: jest.fn().mockResolvedValue(season) },
    category: { create: jest.fn(({ data }) => ({ id: 1, ...data })) },
  };
  return { service: new SeasonsService(prisma), prisma };
}

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
});
