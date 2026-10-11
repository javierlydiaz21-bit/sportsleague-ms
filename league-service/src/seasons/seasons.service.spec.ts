import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { SeasonsService } from './seasons.service';

function build(season: any = { id: 3, leagueId: 7 }, existing: string[] = []) {
  const prisma: any = {
    season: { findUnique: jest.fn().mockResolvedValue(season) },
    category: {
      create: jest.fn(({ data }) => ({ id: 1, ...data })),
      findMany: jest.fn().mockResolvedValue(existing.map((name) => ({ name }))),
    },
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
