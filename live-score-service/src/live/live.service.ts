import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EventType, LiveMatch, LiveStatus, MatchEvent } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MatchEventsPublisher } from '../redis/match-events.publisher';
import { FixtureClientService } from '../clients/fixture-client.service';
import { MetricsService } from '../metrics/metrics.service';
import { RegisterEventDto } from './dto/register-event.dto';

export interface FixturePublishedData {
  seasonId: number;
  categoryId: number;
  matches: Array<{ matchId: number; homeTeam: number; awayTeam: number }>;
}

type Goal = Pick<MatchEvent, 'type' | 'teamId'>;

/** Marcador a partir de los eventos: no se guardan totales (3.5, evita redundancia). */
export function scoreOf(match: Pick<LiveMatch, 'homeTeam' | 'awayTeam'>, events: Goal[]) {
  const goals = events.filter((e) => e.type === EventType.gol);
  return {
    home: goals.filter((g) => g.teamId === match.homeTeam).length,
    away: goals.filter((g) => g.teamId === match.awayTeam).length,
  };
}

@Injectable()
export class LiveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: MatchEventsPublisher,
    private readonly fixtureClient: FixtureClientService,
    private readonly metrics: MetricsService,
  ) {}

  /**
   * Consumo de fixture.published: guarda una copia local de los partidos de la
   * jornada (informacion sincronizada mediante eventos, 3.8). Idempotente.
   */
  async syncFromFixture(data: FixturePublishedData) {
    for (const m of data.matches) {
      const fields = {
        seasonId: data.seasonId,
        categoryId: data.categoryId,
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam,
      };
      await this.prisma.liveMatch.upsert({
        where: { matchId: m.matchId },
        create: { matchId: m.matchId, ...fields },
        update: fields,
      });
    }
  }

  /**
   * Datos del partido. Si el evento fixture.published no llego, se piden por REST
   * al Fixture Service (partido) y al Team Service (categoria), con timeout,
   * reintentos y circuit breaker (4.4).
   */
  async ensureMatch(matchId: number): Promise<LiveMatch> {
    const local = await this.prisma.liveMatch.findUnique({ where: { matchId } });
    if (local) return local;

    const match = await this.fixtureClient.getMatch(matchId);
    if (!match) {
      throw new NotFoundException(`El partido ${matchId} no existe en el Fixture Service`);
    }
    const home = await this.fixtureClient.getTeam(match.homeTeam);
    if (!home) {
      throw new BadRequestException(`El equipo ${match.homeTeam} del partido ${matchId} no existe en el Team Service`);
    }
    const status = (Object.values(LiveStatus) as string[]).includes(match.status)
      ? (match.status as LiveStatus)
      : LiveStatus.programado;
    return this.prisma.liveMatch.upsert({
      where: { matchId },
      create: {
        matchId,
        seasonId: match.seasonId,
        categoryId: home.categoryId,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        status,
      },
      update: {},
    });
  }

  private events(matchId: number) {
    return this.prisma.matchEvent.findMany({
      where: { matchId },
      orderBy: [{ minute: 'asc' }, { id: 'asc' }],
    });
  }

  private snapshot(match: LiveMatch, events: MatchEvent[]) {
    return { ...match, score: scoreOf(match, events), events };
  }

  // GET /matches/{id}/live
  async getLive(matchId: number) {
    const match = await this.ensureMatch(matchId);
    return this.snapshot(match, await this.events(matchId));
  }

  // GET /live-matches?status=en_curso
  async listByStatus(status: LiveStatus) {
    const matches = await this.prisma.liveMatch.findMany({ where: { status }, orderBy: { matchId: 'asc' } });
    if (!matches.length) return [];
    const goals = await this.prisma.matchEvent.findMany({
      where: { matchId: { in: matches.map((m) => m.matchId) }, type: EventType.gol },
      select: { matchId: true, type: true, teamId: true },
    });
    return matches.map((m) => ({ ...m, score: scoreOf(m, goals.filter((g) => g.matchId === m.matchId)) }));
  }

  /**
   * POST /matches/{id}/events: registra un gol, tarjeta o sustitucion, inicia el
   * partido si estaba programado y publica match.event (ASINCRONO). Si el partido
   * ya habia finalizado, es una correccion del acta: se reenvia match.completed
   * para que el Statistics Service recalcule de forma idempotente (4.3).
   */
  async registerEvent(matchId: number, dto: RegisterEventDto) {
    const receivedAt = new Date();
    let match = await this.ensureMatch(matchId);
    if (match.status === LiveStatus.suspendido) {
      throw new ConflictException(`El partido ${matchId} esta suspendido: no admite eventos`);
    }
    if (dto.teamId !== match.homeTeam && dto.teamId !== match.awayTeam) {
      throw new BadRequestException(
        `El equipo ${dto.teamId} no juega el partido ${matchId} (local ${match.homeTeam}, visitante ${match.awayTeam})`,
      );
    }

    const event = await this.prisma.matchEvent.create({
      data: { matchId, type: dto.type, minute: dto.minute, teamId: dto.teamId, playerId: dto.playerId ?? null },
    });
    if (match.status === LiveStatus.programado) {
      match = await this.prisma.liveMatch.update({ where: { matchId }, data: { status: LiveStatus.en_curso } });
    }
    const events = await this.events(matchId);
    const score = scoreOf(match, events);
    this.metrics.matchEvents.inc({ type: dto.type, season: String(match.seasonId), category: String(match.categoryId) });

    await this.publisher.publish('match.event', {
      matchId,
      seasonId: match.seasonId,
      eventId: event.id,
      type: event.type,
      minute: event.minute,
      teamId: event.teamId,
      playerId: event.playerId,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      score,
      registeredAt: receivedAt.toISOString(),
    });
    const correction = match.status === LiveStatus.finalizado;
    if (correction) await this.publishCompleted(match, events, true);
    return { event, score, status: match.status, correction };
  }

  // DELETE /matches/{id}/events/{eventId}: anula un evento registrado por error
  async annulEvent(matchId: number, eventId: number) {
    const receivedAt = new Date();
    const match = await this.ensureMatch(matchId);
    const event = await this.prisma.matchEvent.findFirst({ where: { id: eventId, matchId } });
    if (!event) {
      throw new NotFoundException(`El evento ${eventId} no existe en el partido ${matchId}`);
    }
    await this.prisma.matchEvent.delete({ where: { id: eventId } });
    const events = await this.events(matchId);
    const score = scoreOf(match, events);
    await this.publisher.publish('match.event_annulled', {
      matchId,
      seasonId: match.seasonId,
      eventId,
      score,
      registeredAt: receivedAt.toISOString(),
    });
    const correction = match.status === LiveStatus.finalizado;
    if (correction) await this.publishCompleted(match, events, true);
    return { annulled: event, score, correction };
  }

  /**
   * POST /matches/{id}/complete: cierra el partido y publica match.completed con el
   * acta (resultado y eventos). Si ya estaba cerrado, reenvia el acta: asi se
   * corrige un evento perdido (consistencia eventual, 3.8).
   */
  async complete(matchId: number) {
    const match = await this.ensureMatch(matchId);
    if (match.status === LiveStatus.suspendido) {
      throw new ConflictException(`El partido ${matchId} esta suspendido: no se puede cerrar`);
    }
    const resent = match.status === LiveStatus.finalizado;
    const closed = resent
      ? match
      : await this.prisma.liveMatch.update({
          where: { matchId },
          data: { status: LiveStatus.finalizado, completedAt: new Date() },
        });
    const acta = await this.publishCompleted(closed, await this.events(matchId), false);
    return { ...acta, resent };
  }

  private async publishCompleted(match: LiveMatch, events: MatchEvent[], correction: boolean) {
    const score = scoreOf(match, events);
    const acta = {
      matchId: match.matchId,
      seasonId: match.seasonId,
      categoryId: match.categoryId,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      homeGoals: score.home,
      awayGoals: score.away,
      completedAt: (match.completedAt ?? new Date()).toISOString(),
      correction,
      events: events.map((e) => ({ id: e.id, type: e.type, minute: e.minute, teamId: e.teamId, playerId: e.playerId })),
    };
    await this.publisher.publish('match.completed', acta);
    return acta;
  }

  // POST /matches/{id}/suspend
  async suspend(matchId: number, reason: string) {
    const match = await this.ensureMatch(matchId);
    if (match.status === LiveStatus.finalizado) {
      throw new ConflictException(`El partido ${matchId} ya finalizo: no se puede suspender`);
    }
    const updated = await this.prisma.liveMatch.update({
      where: { matchId },
      data: { status: LiveStatus.suspendido, suspensionReason: reason },
    });
    await this.publisher.publish('match.suspended', {
      matchId,
      seasonId: updated.seasonId,
      homeTeam: updated.homeTeam,
      awayTeam: updated.awayTeam,
      reason,
    });
    return this.snapshot(updated, await this.events(matchId));
  }

  /** Guarda el pico de espectadores conectados al marcador del partido. */
  async recordViewers(matchId: number, viewers: number) {
    await this.prisma.liveMatch.updateMany({
      where: { matchId, peakViewers: { lt: viewers } },
      data: { peakViewers: viewers },
    });
  }
}
