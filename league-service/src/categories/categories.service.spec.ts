import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CategoriesService } from './categories.service';

// Categoria Sub-17 de una liga sin propietario (anterior a la columna owner_id)
const sub17 = { id: 1, leagueId: 4, name: 'Sub-17', ageRange: '15-17', league: { id: 4, ownerId: null } };

function build(category: any = sub17, rule: any = null, siblings: any[] = []) {
  const prisma: any = {
    category: {
      findUnique: jest.fn().mockResolvedValue(category),
      findMany: jest.fn().mockResolvedValue(siblings),
      update: jest.fn(({ data }) => ({ ...category, ...data })),
    },
    rule: {
      findUnique: jest.fn().mockResolvedValue(rule),
      upsert: jest.fn(({ create }) => ({ id: 1, ...create })),
    },
  };
  return { service: new CategoriesService(prisma), prisma };
}

describe('CategoriesService', () => {
  it('PUT rules crea o reemplaza el unico reglamento de la categoria', async () => {
    const { service, prisma } = build();
    await service.updateRules(1, { pointsWin: 3, pointsDraw: 1, tiebreakerCriteria: 'diferencia_de_goles' });
    expect(prisma.rule.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { categoryId: 1 } }));
  });

  it('GET rules responde 404 si la categoria aun no tiene reglamento', async () => {
    const { service } = build(sub17, null);
    await expect(service.getRules(1)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('responde 404 si la categoria no existe', async () => {
    const { service } = build(null);
    await expect(service.findOne(9)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rechaza un empate que vale mas que una victoria', async () => {
    const { service, prisma } = build();
    await expect(
      service.updateRules(1, { pointsWin: 2, pointsDraw: 3, tiebreakerCriteria: 'diferencia_de_goles' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.rule.upsert).not.toHaveBeenCalled();
  });

  it('el reglamento de una liga con propietario solo lo cambia ese organizador (403)', async () => {
    const { service, prisma } = build({ ...sub17, league: { id: 4, ownerId: 7 } });
    const rule = { pointsWin: 3, pointsDraw: 1, tiebreakerCriteria: 'goles_a_favor' };
    await expect(service.updateRules(1, rule, 8)).rejects.toBeInstanceOf(ForbiddenException);
    await service.updateRules(1, rule, 7);
    expect(prisma.rule.upsert).toHaveBeenCalledTimes(1);
  });
});

describe('CategoriesService.update (PATCH /categories/{id})', () => {
  it('cambia el nombre si no repite otra categoria de la liga', async () => {
    const { service, prisma } = build(sub17, null, [
      { id: 1, name: 'Sub-17' },
      { id: 2, name: 'Sub-15' },
    ]);
    const c = await service.update(1, { name: 'Juvenil' }, 7);
    expect(prisma.category.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { name: 'Juvenil' } });
    expect(c.ageRangeChanged).toBe(false);
  });

  it('rechaza (409) un nombre que ya usa otra categoria de la liga', async () => {
    const { service, prisma } = build(sub17, null, [
      { id: 1, name: 'Sub-17' },
      { id: 2, name: 'Sub-15' },
    ]);
    await expect(service.update(1, { name: 'SUB-15' }, 7)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.category.update).not.toHaveBeenCalled();
  });

  it('valida el rango nuevo y marca ageRangeChanged para recalcular la elegibilidad', async () => {
    const { service } = build();
    await expect(service.update(1, { ageRange: '18-15' }, 7)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.update(1, { ageRange: '1-4' }, 7)).rejects.toBeInstanceOf(BadRequestException);
    expect((await service.update(1, { ageRange: '15-18' }, 7)).ageRangeChanged).toBe(true);
    expect((await service.update(1, { ageRange: '15-17' }, 7)).ageRangeChanged).toBe(false);
  });

  it('solo el organizador de la liga puede editar sus categorias (403)', async () => {
    const { service } = build({ ...sub17, league: { id: 4, ownerId: 7 } });
    await expect(service.update(1, { name: 'Otra' }, 8)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
