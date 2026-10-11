import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
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

/** Elegibilidad de un jugador para un rango de edad "min-max". */
export function eligibilityFor(birthDate: Date, ageRange: string, at: Date = new Date()): EligibilityStatus {
  const [min, max] = ageRange.split('-').map(Number);
  const age = calculateAge(birthDate, at);
  return age >= min && age <= max ? EligibilityStatus.elegible : EligibilityStatus.no_elegible;
}

/** Rango "min-max" con formato valido y minimo <= maximo. */
export function isAgeRange(value: string): boolean {
  if (!/^\d{1,2}-\d{1,2}$/.test(value)) return false;
  const [min, max] = value.split('-').map(Number);
  return min <= max;
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
    return { status: eligibilityFor(birthDate, category.ageRange), ageRange: category.ageRange };
  }

  /** Jugadores de los equipos de una categoria, con su equipo. */
  private async playersOf(categoryId: number) {
    const teams = await this.prisma.team.findMany({ where: { categoryId }, include: { players: true }, orderBy: { id: 'asc' } });
    return teams.flatMap((t) => t.players.map((p) => ({ ...p, team: { id: t.id, name: t.name } })));
  }

  /**
   * GET /categories/{id}/eligibility-preview?ageRange= — que jugadores cambiarian de
   * elegibilidad si la categoria tuviera otro rango de edad. No cambia nada: la web lo
   * muestra como advertencia antes de guardar el rango nuevo en el League Service.
   */
  async eligibilityPreview(categoryId: number, ageRange: string) {
    if (!isAgeRange(ageRange)) {
      throw new BadRequestException('ageRange debe tener el formato "min-max", con el minimo menor o igual al maximo');
    }
    const players = await this.playersOf(categoryId);
    const changes = players
      .map((p) => ({
        playerId: p.id,
        name: p.name,
        jerseyNumber: p.jerseyNumber,
        birthDate: p.birthDate,
        team: p.team,
        from: p.eligibilityStatus,
        to: eligibilityFor(p.birthDate, ageRange),
      }))
      .filter((c) => c.from !== c.to);
    return {
      categoryId,
      ageRange,
      players: players.length,
      becomeIneligible: changes.filter((c) => c.to === EligibilityStatus.no_elegible).length,
      becomeEligible: changes.filter((c) => c.to === EligibilityStatus.elegible).length,
      changes,
    };
  }

  /**
   * POST /categories/{id}/eligibility/recalculate — recalcula la elegibilidad de todos los
   * jugadores de la categoria con el rango vigente en el League Service (despues de corregirlo).
   * Si el League Service no responde no cambia nada (503).
   */
  async recalculateCategory(categoryId: number) {
    const category = await this.leagueClient.getCategory(categoryId);
    if (!category) {
      throw new ServiceUnavailableException('No se pudo leer la categoria en el League Service; intente de nuevo en unos segundos');
    }
    const players = await this.playersOf(categoryId);
    const updates = players
      .map((p) => ({ id: p.id, status: eligibilityFor(p.birthDate, category.ageRange), before: p.eligibilityStatus }))
      .filter((u) => u.status !== u.before);
    if (updates.length) {
      await this.prisma.$transaction(
        updates.map((u) => this.prisma.player.update({ where: { id: u.id }, data: { eligibilityStatus: u.status } })),
      );
    }
    return { categoryId, ageRange: category.ageRange, players: players.length, updated: updates.length };
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
