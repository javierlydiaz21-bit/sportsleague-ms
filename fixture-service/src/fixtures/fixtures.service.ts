import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisPublisherService } from '../redis/redis-publisher.service';
import { LeagueClientService } from '../clients/league-client.service';
import { TeamClientService, TeamInfo } from '../clients/team-client.service';
import { GenerateFixtureDto } from './dto/generate-fixture.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';
import { generateRoundRobin } from './fixture-generator.util';

@Injectable()
export class FixturesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: RedisPublisherService,
    private readonly leagueClient: LeagueClientService,
    private readonly teamClient: TeamClientService,
  ) {}

  /**
   * POST /seasons/{id}/fixtures/generate
   *  1) SINCRONO -> League Service: reglamento vigente de la categoria.
   *  2) SINCRONO -> Team Service: valida cada equipo participante.
   *  3) Genera y guarda el calendario.
   *  4) ASINCRONO: publica fixture.published por cada jornada confirmada.
   */
  async generate(seasonId: number, dto: GenerateFixtureDto) {
    const existing = await this.prisma.match.count({ where: { seasonId } });
    if (existing > 0) {
      throw new ConflictException(`La temporada ${seasonId} ya tiene un calendario generado.`);
    }

    // 1) League Service
    const rules = await this.leagueClient.getRules(dto.categoryId);
    if (!rules) {
      throw new BadRequestException(
        `La categoria ${dto.categoryId} no existe o no tiene reglamento definido en el League Service.`,
      );
    }

    // 2) Team Service
    const teams: TeamInfo[] = [];
    for (const teamId of dto.teamIds) {
      const team = await this.teamClient.getTeam(teamId);
      if (!team) {
        throw new BadRequestException(`El equipo ${teamId} no existe en el Team Service.`);
      }
      if (team.categoryId !== dto.categoryId) {
        throw new BadRequestException(
          `El equipo ${teamId} (${team.name}) pertenece a la categoria ${team.categoryId}, no a la ${dto.categoryId}.`,
        );
      }
      teams.push(team);
    }

    // 3) Generacion y persistencia
    const generated = generateRoundRobin(
      dto.teamIds,
      dto.venues,
      new Date(dto.startDate),
      dto.daysBetweenRounds ?? 7,
      dto.restDaysMin ?? 3,
    );
    // Restriccion (3.3): home_team y away_team no pueden ser iguales
    if (generated.some((m) => m.homeTeam === m.awayTeam)) {
      throw new BadRequestException('Un partido no puede tener el mismo equipo como local y visitante.');
    }

    const created = await this.prisma.$transaction(
      generated.map((m) =>
        this.prisma.match.create({
          data: {
            seasonId,
            homeTeam: m.homeTeam,
            awayTeam: m.awayTeam,
            venue: m.venue,
            scheduledAt: m.scheduledAt,
          },
        }),
      ),
    );

    // 4) Un evento por jornada
    const totalJornadas = Math.max(...generated.map((m) => m.jornada));
    for (let jornada = 1; jornada <= totalJornadas; jornada++) {
      const matches = created
        .filter((_, i) => generated[i].jornada === jornada)
        .map((m) => ({
          matchId: m.id,
          homeTeam: m.homeTeam,
          awayTeam: m.awayTeam,
          venue: m.venue,
          scheduledAt: m.scheduledAt.toISOString(),
        }));
      await this.publisher.publishFixturePublished({
        seasonId,
        categoryId: dto.categoryId,
        zone: dto.zone,
        jornada,
        matches,
      });
    }

    return {
      seasonId,
      categoryId: dto.categoryId,
      totalMatches: created.length,
      totalJornadas,
      reglamento: rules,
      equiposValidados: teams,
      matches: created,
    };
  }

  findBySeason(seasonId: number) {
    return this.prisma.match.findMany({
      where: { seasonId },
      orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
    });
  }

  async findOne(id: number) {
    const match = await this.prisma.match.findUnique({ where: { id } });
    if (!match) {
      throw new NotFoundException(`No se encontro el partido con id ${id}`);
    }
    return match;
  }

  async updateVenue(id: number, dto: UpdateVenueDto) {
    await this.findOne(id);
    return this.prisma.match.update({ where: { id }, data: { venue: dto.venue } });
  }
}
