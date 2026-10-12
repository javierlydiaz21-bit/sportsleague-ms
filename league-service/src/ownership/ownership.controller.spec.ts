import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OwnershipController } from './ownership.controller';

function build() {
  const prisma: any = {
    league: { findUnique: jest.fn(({ where }) => (where.id === 1 ? { id: 1, ownerId: 7 } : null)) },
    season: { findUnique: jest.fn(({ where }) => (where.id === 3 ? { league: { id: 1, ownerId: 7 } } : null)) },
    category: {
      findUnique: jest.fn(({ where }) => (where.id === 5 ? { league: { id: 2, ownerId: null } } : null)),
      findMany: jest.fn(({ where }) =>
        [
          { id: 5, league: { id: 2, ownerId: null } },
          { id: 6, league: { id: 1, ownerId: 7 } },
        ].filter((c) => where.id.in.includes(c.id)),
      ),
    },
  };
  return new OwnershipController(prisma);
}

describe('OwnershipController (consulta interna del API Gateway)', () => {
  it('devuelve la liga y el propietario de una liga, temporada o categoria', async () => {
    const c = build();
    expect(await c.league(1)).toEqual({ leagueId: 1, ownerId: 7 });
    expect(await c.season(3)).toEqual({ leagueId: 1, ownerId: 7 });
    expect(await c.category(5)).toEqual({ leagueId: 2, ownerId: null });
  });

  it('responde 404 si no existe', async () => {
    const c = build();
    await expect(c.league(9)).rejects.toBeInstanceOf(NotFoundException);
    await expect(c.season(9)).rejects.toBeInstanceOf(NotFoundException);
    await expect(c.category(9)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('resuelve varias categorias a la vez y avisa si falta alguna', async () => {
    const c = build();
    expect(await c.categories('5,6')).toEqual([
      { categoryId: 5, leagueId: 2, ownerId: null },
      { categoryId: 6, leagueId: 1, ownerId: 7 },
    ]);
    await expect(c.categories('5,99')).rejects.toBeInstanceOf(NotFoundException);
    await expect(c.categories('')).rejects.toBeInstanceOf(BadRequestException);
  });
});
