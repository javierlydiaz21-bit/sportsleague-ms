import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  // GET /analytics/attendance
  async attendance(seasonId?: number) {
    const matches = await this.prisma.attendanceEstimate.findMany({
      where: seasonId ? { seasonId } : {},
      orderBy: [{ estimatedAttendance: 'desc' }, { matchId: 'asc' }],
    });
    const total = matches.reduce((sum, m) => sum + m.estimatedAttendance, 0);
    return {
      total,
      average: matches.length ? Math.round(total / matches.length) : 0,
      matches,
    };
  }

  // GET /analytics/suspended-matches
  async suspended(seasonId?: number) {
    const matches = await this.prisma.suspendedMatch.findMany({
      where: seasonId ? { seasonId } : {},
      orderBy: { matchId: 'asc' },
    });
    return { count: matches.length, matches };
  }

  // GET /analytics/team-trend/{teamId}
  async teamTrend(teamId: number, seasonId?: number) {
    const points = await this.prisma.teamPerformanceTrend.findMany({
      where: { teamId, ...(seasonId && { seasonId }) },
      orderBy: [{ seasonId: 'asc' }, { matchNumber: 'asc' }],
    });
    return { teamId, points };
  }

  /** Tendencia de todos los equipos de una temporada (para el grafico comparativo). */
  async seasonTrend(seasonId: number) {
    const points = await this.prisma.teamPerformanceTrend.findMany({
      where: { seasonId },
      orderBy: [{ teamId: 'asc' }, { matchNumber: 'asc' }],
    });
    return { seasonId, points };
  }

  // GET /analytics/summary
  async summary() {
    const recent = await this.prisma.etlRun.findMany({ orderBy: { id: 'desc' }, take: 10 });
    const lastRun = recent[0] ?? null;
    // Conteos de la ultima corrida que si pudo leer la replica del Fixture Service
    const counts = (recent.map((r) => r.summary as Record<string, unknown> | null).find((s) => s && 'totalMatches' in s) ??
      {}) as Record<string, unknown>;
    const attendance = await this.attendance();
    return {
      totalMatches: counts.totalMatches ?? 0,
      scheduled: counts.scheduled ?? 0,
      live: counts.live ?? 0,
      played: counts.played ?? 0,
      suspended: counts.suspended ?? 0,
      totalAttendance: attendance.total,
      averageAttendance: attendance.average,
      lastRun: lastRun && {
        status: lastRun.status,
        startedAt: lastRun.startedAt,
        finishedAt: lastRun.finishedAt,
        errors: lastRun.errors,
      },
    };
  }
}
