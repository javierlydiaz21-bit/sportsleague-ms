import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { FixtureClientService } from '../clients/fixture-client.service';
import { normalizeName, seasonError } from '../common/catalog';
import { assertCanEdit } from '../common/ownership';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeagueDto } from './dto/create-league.dto';
import { CreateSeasonDto } from './dto/create-season.dto';
import { UpdateLeagueDto } from './dto/update-league.dto';

@Injectable()
export class LeaguesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fixtures: FixtureClientService,
  ) {}

  /**
   * Crea la liga a nombre de quien la pide (x-user-id que envia el API Gateway).
   * Si el mismo organizador ya tiene una liga con ese nombre responde 409, salvo que
   * confirme con confirmDuplicate. Organizadores distintos si pueden usar el mismo nombre.
   */
  async create(dto: CreateLeagueDto, ownerId: number | null = null) {
    const { confirmDuplicate, ...data } = dto;
    if (ownerId && !confirmDuplicate) await this.assertNameFree(ownerId, data.name);
    return this.prisma.league.create({ data: { ...data, ownerId } });
  }

  /** 409 si el organizador ya tiene otra liga con ese nombre (sin distinguir mayusculas ni tildes). */
  private async assertNameFree(ownerId: number, name: string, exceptId?: number) {
    const mine = await this.prisma.league.findMany({ where: { ownerId }, select: { id: true, name: true } });
    const twin = mine.find((l) => l.id !== exceptId && normalizeName(l.name) === normalizeName(name));
    if (twin) {
      throw new ConflictException(
        `Ya tienes una liga llamada ${twin.name}. Envie confirmDuplicate: true para usar el mismo nombre`,
      );
    }
  }

  private readonly withChildren = {
    seasons: { orderBy: { year: 'desc' as const } },
    categories: { orderBy: { id: 'asc' as const }, include: { rule: true } },
  };

  findAll() {
    return this.prisma.league.findMany({ include: this.withChildren, orderBy: { id: 'asc' } });
  }

  /** Ligas del organizador (las ligas sin propietario no aparecen). */
  findMine(ownerId: number | null) {
    if (!ownerId) {
      throw new BadRequestException('Falta el usuario: consulte sus ligas a traves del API Gateway');
    }
    return this.prisma.league.findMany({ where: { ownerId }, include: this.withChildren, orderBy: { id: 'desc' } });
  }

  async findOne(id: number) {
    const league = await this.prisma.league.findUnique({ where: { id }, include: this.withChildren });
    if (!league) {
      throw new NotFoundException(`No se encontro la liga con id ${id}`);
    }
    return league;
  }

  /**
   * PATCH /leagues/{id}: corrige el nombre o el deporte. El deporte solo cambia mientras
   * ninguna temporada tenga calendario (se consulta al Fixture Service).
   */
  async update(id: number, dto: UpdateLeagueDto, userId: number | null) {
    const league = await this.findOne(id);
    assertCanEdit(league, userId);
    const data: { name?: string; sport?: string } = {};

    if (dto.name !== undefined && dto.name !== league.name) {
      // Si solo cambian mayusculas o espacios es la misma liga; si no, se revisa que no se repita
      const sameName = normalizeName(dto.name) === normalizeName(league.name);
      if (!sameName && league.ownerId && !dto.confirmDuplicate) await this.assertNameFree(league.ownerId, dto.name, id);
      data.name = dto.name;
    }

    if (dto.sport !== undefined && dto.sport !== league.sport) {
      for (const season of league.seasons) {
        const matches = await this.fixtures.matchesOf(season.id);
        if (matches.length) {
          throw new ConflictException(
            `No se puede cambiar el deporte: la temporada ${season.year} ya tiene calendario (${matches.length} partidos)`,
          );
        }
      }
      data.sport = dto.sport;
    }

    if (!Object.keys(data).length) return league;
    await this.prisma.league.update({ where: { id }, data });
    return this.findOne(id);
  }

  async createSeason(leagueId: number, dto: CreateSeasonDto) {
    const league = await this.prisma.league.findUnique({ where: { id: leagueId } });
    if (!league) {
      throw new NotFoundException(`No se encontro la liga con id ${leagueId}`);
    }

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    // Restriccion del documento (3.2): start_date anterior a end_date; y el año corresponde a sus fechas
    const error = seasonError(dto.year, startDate, endDate);
    if (error) throw new BadRequestException(error);

    return this.prisma.season.create({
      data: { leagueId, year: dto.year, startDate, endDate },
    });
  }
}
