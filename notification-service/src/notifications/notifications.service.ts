import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TeamClientService } from '../clients/team-client.service';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

const DAYS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const formatDate = (iso: string) => `${DAYS[new Date(iso).getUTCDay()]} ${iso.slice(0, 10)}`;

interface NewNotification {
  key: string;
  type: string;
  title: string;
  body: string;
  matchId?: number;
  teamIds: number[];
  userId?: number;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly teams: TeamClientService,
  ) {}

  private async versus(homeTeam: number, awayTeam: number) {
    return `${await this.teams.teamName(homeTeam)} vs ${await this.teams.teamName(awayTeam)}`;
  }

  /**
   * Guarda la notificacion (si ya existia una con la misma clave, la actualiza) y la
   * "envia" por los canales que eligio cada usuario que sigue a esos equipos. El
   * envio real por push o email queda fuera del alcance del proyecto: se registra.
   */
  private async notify(n: NewNotification) {
    const { key, ...fields } = n;
    const saved = await this.prisma.notification.upsert({ where: { key }, create: n, update: fields });

    const followers = await this.prisma.notificationPreference.findMany({
      where: n.userId ? { userId: n.userId } : { followedTeams: { hasSome: n.teamIds } },
    });
    for (const f of followers) {
      for (const channel of f.channels) {
        this.logger.log(`[${channel}] usuario ${f.userId}: ${n.title} — ${n.body}`);
      }
    }
    return { ...saved, deliveries: followers.reduce((sum, f) => sum + f.channels.length, 0) };
  }

  /** fixture.published: horario confirmado de cada partido de la jornada. */
  async onFixturePublished(data: {
    jornada: number;
    matches: Array<{ matchId: number; homeTeam: number; awayTeam: number; venue: string; scheduledAt: string }>;
  }) {
    const out: Awaited<ReturnType<NotificationsService['notify']>>[] = [];
    for (const m of data.matches) {
      out.push(
        await this.notify({
          key: `horario:${m.matchId}`,
          type: 'horario_confirmado',
          title: `Horario confirmado, jornada ${data.jornada}`,
          body: `${await this.versus(m.homeTeam, m.awayTeam)}: ${formatDate(m.scheduledAt)} en ${m.venue}.`,
          matchId: m.matchId,
          teamIds: [m.homeTeam, m.awayTeam],
        }),
      );
    }
    return out;
  }

  /** fixture.venue_changed: cambio de sede de ultimo momento. */
  async onVenueChanged(data: {
    matchId: number;
    homeTeam: number;
    awayTeam: number;
    venue: string;
    previousVenue: string;
    scheduledAt: string;
  }) {
    return this.notify({
      key: `sede:${data.matchId}:${data.venue}`,
      type: 'cambio_de_sede',
      title: 'Cambio de sede',
      body:
        `${await this.versus(data.homeTeam, data.awayTeam)} (${formatDate(data.scheduledAt)}) ` +
        `se juega en ${data.venue}, ya no en ${data.previousVenue}.`,
      matchId: data.matchId,
      teamIds: [data.homeTeam, data.awayTeam],
    });
  }

  /** match.completed: resultado final. Un acta corregida actualiza el mismo aviso. */
  async onMatchCompleted(data: {
    matchId: number;
    homeTeam: number;
    awayTeam: number;
    homeGoals: number;
    awayGoals: number;
    correction?: boolean;
  }) {
    const home = await this.teams.teamName(data.homeTeam);
    const away = await this.teams.teamName(data.awayTeam);
    return this.notify({
      key: `resultado:${data.matchId}`,
      type: 'resultado_final',
      title: data.correction ? 'Resultado final (acta corregida)' : 'Resultado final',
      body: `${home} ${data.homeGoals} - ${data.awayGoals} ${away}.`,
      matchId: data.matchId,
      teamIds: [data.homeTeam, data.awayTeam],
    });
  }

  /** match.suspended */
  async onMatchSuspended(data: { matchId: number; homeTeam: number; awayTeam: number; reason: string }) {
    return this.notify({
      key: `suspendido:${data.matchId}`,
      type: 'partido_suspendido',
      title: 'Partido suspendido',
      body: `${await this.versus(data.homeTeam, data.awayTeam)}: ${data.reason}.`,
      matchId: data.matchId,
      teamIds: [data.homeTeam, data.awayTeam],
    });
  }

  // GET /notifications/{userId}
  async findForUser(userId: number) {
    const preferences = await this.prisma.notificationPreference.findUnique({ where: { userId } });
    const teams = preferences?.followedTeams ?? [];
    // Sin equipos seguidos se muestran los avisos de toda la liga
    const where = {
      OR: [{ userId }, teams.length ? { teamIds: { hasSome: teams } } : { userId: null }],
    };
    const notifications = await this.prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return {
      userId,
      preferences: preferences ?? { userId, followedTeams: [], channels: [] },
      notifications,
    };
  }

  // PUT /notifications/preferences
  updatePreferences(dto: UpdatePreferencesDto) {
    const data = { followedTeams: dto.followedTeams, channels: dto.channels };
    return this.prisma.notificationPreference.upsert({
      where: { userId: dto.userId },
      create: { userId: dto.userId, ...data },
      update: data,
    });
  }

  // POST /notifications/test
  sendTest(userId: number) {
    return this.notify({
      key: `prueba:${userId}:${Date.now()}`,
      type: 'prueba',
      title: 'Notificacion de prueba',
      body: 'Si ves este aviso, tus notificaciones de SportsLeague funcionan.',
      teamIds: [],
      userId,
    });
  }
}
