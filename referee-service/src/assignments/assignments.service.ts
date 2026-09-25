import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { dayOf } from '../common/days';

export interface MatchToAssign {
  matchId: number;
  scheduledAt: string;
}

@Injectable()
export class AssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Asignacion automatica (documento 2.4): entre los arbitros de la zona,
   * certificados para la categoria del encuentro y disponibles el dia del
   * partido, elige al que tiene menos asignaciones. `busy` son los arbitros
   * ya usados en la misma jornada (no pueden pitar dos partidos a la vez).
   * Idempotente: si el partido ya tiene arbitro, no crea otra asignacion.
   */
  async autoAssign(match: MatchToAssign, categoryId: number, zone: string, busy: Set<number>) {
    const day = dayOf(new Date(match.scheduledAt));
    const existing = await this.prisma.refereeAssignment.findFirst({ where: { matchId: match.matchId } });
    if (existing) return { assignment: existing, created: false, day };

    const candidates = await this.prisma.referee.findMany({
      where: {
        zone,
        categoriesCertified: { has: categoryId },
        availability: { has: day },
      },
      include: { _count: { select: { assignments: true } } },
    });

    const free = candidates
      .filter((r) => !busy.has(r.id))
      .sort((a, b) => a._count.assignments - b._count.assignments);
    if (free.length === 0) return { assignment: null, created: false, day };

    const assignment = await this.prisma.refereeAssignment.create({
      data: { matchId: match.matchId, refereeId: free[0].id },
    });
    return { assignment, created: true, day };
  }

  // PUT /assignments/{id}/confirm
  async confirm(id: number) {
    const assignment = await this.prisma.refereeAssignment.findUnique({ where: { id } });
    if (!assignment) {
      throw new NotFoundException(`No se encontro la asignacion con id ${id}`);
    }
    return this.prisma.refereeAssignment.update({ where: { id }, data: { confirmed: true } });
  }
}
