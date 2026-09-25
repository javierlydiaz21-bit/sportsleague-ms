import { NotFoundException } from '@nestjs/common';
import { AssignmentsService } from './assignments.service';
import { dayOf } from '../common/days';

const referee = (id: number, assignments: number) => ({ id, zone: 'monteria-norte', _count: { assignments } });

function build(candidates: any[], existing: any = null) {
  let nextId = 1;
  const prisma: any = {
    refereeAssignment: {
      findFirst: jest.fn().mockResolvedValue(existing),
      create: jest.fn(({ data }) => ({ id: nextId++, confirmed: false, ...data })),
      findUnique: jest.fn(),
      update: jest.fn(({ data }) => ({ id: 1, ...data })),
    },
    referee: { findMany: jest.fn().mockResolvedValue(candidates) },
  };
  return { service: new AssignmentsService(prisma), prisma };
}

const match = { matchId: 10, scheduledAt: '2026-10-03T00:00:00.000Z' }; // sabado

describe('dayOf', () => {
  it('2026-10-03 es sabado', () => expect(dayOf(new Date(match.scheduledAt))).toBe('sabado'));
});

describe('AssignmentsService.autoAssign (consumo de fixture.published)', () => {
  it('busca arbitros por zona, categoria certificada y dia disponible', async () => {
    const { service, prisma } = build([referee(1, 0)]);
    await service.autoAssign(match, 1, 'monteria-norte', new Set());
    expect(prisma.referee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { zone: 'monteria-norte', categoriesCertified: { has: 1 }, availability: { has: 'sabado' } },
      }),
    );
  });

  it('elige al arbitro con menos asignaciones', async () => {
    const { service } = build([referee(1, 3), referee(2, 1)]);
    const r = await service.autoAssign(match, 1, 'monteria-norte', new Set());
    expect(r.assignment?.refereeId).toBe(2);
    expect(r.created).toBe(true);
  });

  it('no usa un arbitro ya ocupado en la misma jornada', async () => {
    const { service } = build([referee(1, 0), referee(2, 5)]);
    const r = await service.autoAssign(match, 1, 'monteria-norte', new Set([1]));
    expect(r.assignment?.refereeId).toBe(2);
  });

  it('es idempotente: si el partido ya tiene arbitro no crea otro', async () => {
    const { service, prisma } = build([referee(1, 0)], { id: 7, matchId: 10, refereeId: 1 });
    const r = await service.autoAssign(match, 1, 'monteria-norte', new Set());
    expect(r.created).toBe(false);
    expect(prisma.refereeAssignment.create).not.toHaveBeenCalled();
  });

  it('devuelve null si no hay arbitros disponibles', async () => {
    const { service } = build([]);
    const r = await service.autoAssign(match, 1, 'monteria-norte', new Set());
    expect(r.assignment).toBeNull();
  });
});

describe('AssignmentsService.confirm', () => {
  it('marca la asignacion como confirmada', async () => {
    const { service, prisma } = build([]);
    prisma.refereeAssignment.findUnique.mockResolvedValue({ id: 1, confirmed: false });
    const a = await service.confirm(1);
    expect(a.confirmed).toBe(true);
  });

  it('responde 404 si la asignacion no existe', async () => {
    const { service, prisma } = build([]);
    prisma.refereeAssignment.findUnique.mockResolvedValue(null);
    await expect(service.confirm(99)).rejects.toBeInstanceOf(NotFoundException);
  });
});
