import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LeagueClientService } from '../clients/league-client.service';
import { StandingsCacheService } from '../redis/standings-cache.service';
import { buildStandings, pointsFor, sortStandings } from './standings.util';

export interface MatchCompletedData {
  matchId: number;
  seasonId: number;
  categoryId: number;
  homeTeam: number;
  awayTeam: number;
  homeGoals: number;
  awayGoals: number;
  completedAt: string;
  correction?: boolean;
  events: Array<{ type: string; minute: number; teamId: number; playerId: number | null }>;
}

const DEFAULT_TIEBREAKER = 'diferencia_de_goles';
const CARDS = ['tarjeta_amarilla', 'tarjeta_roja'];

@Injectable()
export class StatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly league: LeagueClientService,
    private readonly cache: StandingsCacheService,
  ) {}

  /**
   * Consumo de match.completed (documento 2.6): guarda el acta y recalcula la tabla
   * de posiciones, los goleadores y las tarjetas. Si llega de nuevo la misma acta,
   * o una version corregida, reemplaza la anterior: nunca suma dos veces.
   */
  async processMatchCompleted(acta: MatchCompletedData) {
    const previous = await this.prisma.matchResultEvent.findMany({
      where: { matchId: acta.matchId },
      select: { playerId: true },
    });
    const result = {
      seasonId: acta.seasonId,
      categoryId: acta.categoryId,
      homeTeam: acta.homeTeam,
      awayTeam: acta.awayTeam,
      homeGoals: acta.homeGoals,
      awayGoals: acta.awayGoals,
      completedAt: new Date(acta.completedAt),
    };
    await this.prisma.$transaction([
      this.prisma.matchResult.upsert({
        where: { matchId: acta.matchId },
        create: { matchId: acta.matchId, ...result },
        update: result,
      }),
      this.prisma.matchResultEvent.deleteMany({ where: { matchId: acta.matchId } }),
      this.prisma.matchResultEvent.createMany({
        data: acta.events.map((e) => ({
          matchId: acta.matchId,
          type: e.type,
          minute: e.minute,
          teamId: e.teamId,
          playerId: e.playerId ?? null,
        })),
      }),
    ]);

    const affected = [...previous, ...acta.events]
      .map((e) => e.playerId)
      .filter((id): id is number => typeof id === 'number');
    await this.recalculateDisciplinary([...new Set(affected)]);
    return this.recalculateSeason(acta.seasonId);
  }

  /** Consumo de fixture.published: los equipos de la temporada entran a la tabla con 0 puntos. */
  async registerSeasonTeams(seasonId: number, teamIds: number[]) {
    const zero = { points: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0 };
    await this.prisma.$transaction(
      teamIds.map((teamId) =>
        this.prisma.standing.upsert({
          where: { seasonId_teamId: { seasonId, teamId } },
          create: { seasonId, teamId, ...zero },
          update: {},
        }),
      ),
    );
    await this.cache.invalidate(seasonId);
  }

  /**
   * Recalcula la temporada desde cero con todas sus actas (idempotente). El
   * reglamento de cada categoria se consulta de forma SINCRONA al League Service.
   */
  async recalculateSeason(seasonId: number) {
    const results = await this.prisma.matchResult.findMany({ where: { seasonId } });
    if (results.length === 0) return { seasonId, matches: 0, teams: 0 };

    const rulesByCategory = new Map<number, { pointsWin: number; pointsDraw: number }>();
    for (const categoryId of new Set(results.map((r) => r.categoryId))) {
      const rules = await this.league.getRules(categoryId);
      if (!rules) {
        throw new BadRequestException(`La categoria ${categoryId} no tiene reglamento en el League Service`);
      }
      rulesByCategory.set(categoryId, rules);
    }

    const scored = results.map((r) => ({ ...r, ...pointsFor(r, rulesByCategory.get(r.categoryId)!) }));
    const existing = await this.prisma.standing.findMany({ where: { seasonId }, select: { teamId: true } });
    const rows = buildStandings(
      scored,
      existing.map((s) => s.teamId),
    );

    const goals = await this.prisma.matchResultEvent.groupBy({
      by: ['playerId'],
      where: { type: 'gol', playerId: { not: null }, matchId: { in: results.map((r) => r.matchId) } },
      _count: { _all: true },
    });

    await this.prisma.$transaction([
      ...scored
        .filter((r, i) => r.homePoints !== results[i].homePoints || r.awayPoints !== results[i].awayPoints)
        .map((r) =>
          this.prisma.matchResult.update({
            where: { matchId: r.matchId },
            data: { homePoints: r.homePoints, awayPoints: r.awayPoints },
          }),
        ),
      ...rows.map((row) =>
        this.prisma.standing.upsert({
          where: { seasonId_teamId: { seasonId, teamId: row.teamId } },
          create: { seasonId, ...row },
          update: row,
        }),
      ),
      this.prisma.topScorer.deleteMany({ where: { seasonId } }),
      this.prisma.topScorer.createMany({
        data: goals.map((g) => ({ seasonId, playerId: g.playerId!, goals: g._count._all })),
      }),
    ]);
    await this.cache.invalidate(seasonId);
    return { seasonId, matches: results.length, teams: rows.length };
  }

  /** Tarjetas acumuladas por jugador, contadas desde cero en todas las actas. */
  async recalculateDisciplinary(playerIds: number[]) {
    if (playerIds.length === 0) return;
    const counts = await this.prisma.matchResultEvent.groupBy({
      by: ['playerId', 'type'],
      where: { playerId: { in: playerIds }, type: { in: CARDS } },
      _count: { _all: true },
    });
    const count = (playerId: number, type: string) =>
      counts.find((c) => c.playerId === playerId && c.type === type)?._count._all ?? 0;
    await this.prisma.$transaction(
      playerIds.map((playerId) => {
        const data = { yellowCards: count(playerId, 'tarjeta_amarilla'), redCards: count(playerId, 'tarjeta_roja') };
        return this.prisma.disciplinaryRecord.upsert({
          where: { playerId },
          create: { playerId, ...data },
          update: data,
        });
      }),
    );
  }

  private async tiebreakerFor(seasonId: number): Promise<string> {
    const any = await this.prisma.matchResult.findFirst({ where: { seasonId }, select: { categoryId: true } });
    if (!any) return DEFAULT_TIEBREAKER;
    try {
      return (await this.league.getRules(any.categoryId))?.tiebreakerCriteria ?? DEFAULT_TIEBREAKER;
    } catch {
      return DEFAULT_TIEBREAKER; // League Service no disponible: se ordena con el criterio por defecto
    }
  }

  // GET /standings/{seasonId}
  async getStandings(seasonId: number) {
    const cached = await this.cache.get<Awaited<ReturnType<StatsService['readStandings']>>>(seasonId);
    if (cached) return { ...cached, cached: true };
    const body = await this.readStandings(seasonId);
    await this.cache.set(seasonId, body);
    return { ...body, cached: false };
  }

  private async readStandings(seasonId: number) {

    const rows = await this.prisma.standing.findMany({ where: { seasonId } });
    const tiebreakerCriteria = await this.tiebreakerFor(seasonId);
    const standings = sortStandings(rows, tiebreakerCriteria).map((r, i) => ({
      position: i + 1,
      played: r.wins + r.draws + r.losses,
      ...r,
    }));
    return { seasonId, tiebreakerCriteria, standings };
  }

  // GET /top-scorers/{seasonId}
  async getTopScorers(seasonId: number) {
    const rows = await this.prisma.topScorer.findMany({
      where: { seasonId, goals: { gt: 0 } },
      orderBy: [{ goals: 'desc' }, { playerId: 'asc' }],
      take: 20,
    });
    return rows.map((r, i) => ({ position: i + 1, ...r }));
  }

  // GET /players/{id}/disciplinary-record
  async getDisciplinaryRecord(playerId: number) {
    const record = await this.prisma.disciplinaryRecord.findUnique({ where: { playerId } });
    return record ?? { playerId, yellowCards: 0, redCards: 0 };
  }
}
