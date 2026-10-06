import { Injectable, NotFoundException } from '@nestjs/common';
import { EligibilityStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LeagueClientService } from '../league-client/league-client.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { CreatePlayerDto } from './dto/create-player.dto';

/** Edad en anios cumplidos a la fecha indicada. */
export function calculateAge(birthDate: Date, at: Date = new Date()): number {
  let age = at.getFullYear() - birthDate.getFullYear();
  const m = at.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && at.getDate() < birthDate.getDate())) age--;
  return age;
}

@Injectable()
export class TeamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly leagueClient: LeagueClientService,
  ) {}

  create(dto: CreateTeamDto) {
    return this.prisma.team.create({ data: dto });
  }

  /** GET /teams?categoryId=&ids= — equipos con su plantilla (lectura de apoyo para la web). */
  findMany(filter: { categoryId?: number; ids?: number[] }) {
    return this.prisma.team.findMany({
      where: {
        ...(filter.categoryId !== undefined && { categoryId: filter.categoryId }),
        ...(filter.ids && { id: { in: filter.ids } }),
      },
      include: { players: { orderBy: { jerseyNumber: 'asc' } } },
      orderBy: { id: 'asc' },
    });
  }

  async findOne(id: number) {
    const team = await this.prisma.team.findUnique({ where: { id } });
    if (!team) {
      throw new NotFoundException(`No se encontro el equipo con id ${id}`);
    }
    return team;
  }

  /**
   * Verificacion de elegibilidad (edad minima/maxima segun la categoria).
   * Consulta SINCRONA al League Service para leer el age_range.
   */
  private async computeEligibility(categoryId: number, birthDate: Date) {
    const category = await this.leagueClient.getCategory(categoryId);
    if (!category) {
      return { status: EligibilityStatus.pendiente, ageRange: null as string | null };
    }
    const [min, max] = category.ageRange.split('-').map(Number);
    const age = calculateAge(birthDate);
    const status =
      age >= min && age <= max ? EligibilityStatus.elegible : EligibilityStatus.no_elegible;
    return { status, ageRange: category.ageRange };
  }

  /** Ficha un jugador validando automaticamente su elegibilidad. */
  async addPlayer(teamId: number, dto: CreatePlayerDto) {
    const team = await this.findOne(teamId);
    const birthDate = new Date(dto.birthDate);
    const { status } = await this.computeEligibility(team.categoryId, birthDate);

    return this.prisma.player.create({
      data: {
        teamId,
        name: dto.name,
        birthDate,
        jerseyNumber: dto.jerseyNumber,
        eligibilityStatus: status,
      },
    });
  }

  async findPlayers(teamId: number) {
    await this.findOne(teamId);
    return this.prisma.player.findMany({
      where: { teamId },
      orderBy: { jerseyNumber: 'asc' },
    });
  }

  /**
   * PUT /players/{id}/eligibility — vuelve a verificar la elegibilidad del
   * jugador contra el age_range vigente de su categoria (por ejemplo, si
   * quedo "pendiente" porque el League Service no respondio al ficharlo).
   */
  async verifyEligibility(playerId: number) {
    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
      include: { team: true },
    });
    if (!player) {
      throw new NotFoundException(`No se encontro el jugador con id ${playerId}`);
    }

    const { status } = await this.computeEligibility(player.team.categoryId, player.birthDate);
    return this.prisma.player.update({
      where: { id: playerId },
      data: { eligibilityStatus: status },
    });
  }
}
