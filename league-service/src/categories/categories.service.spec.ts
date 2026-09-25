import { NotFoundException } from '@nestjs/common';
import { CategoriesService } from './categories.service';

function build(category: any = { id: 1 }, rule: any = null) {
  const prisma: any = {
    category: { findUnique: jest.fn().mockResolvedValue(category) },
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
    const { service } = build({ id: 1 }, null);
    await expect(service.getRules(1)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('responde 404 si la categoria no existe', async () => {
    const { service } = build(null);
    await expect(service.findOne(9)).rejects.toBeInstanceOf(NotFoundException);
  });
});
