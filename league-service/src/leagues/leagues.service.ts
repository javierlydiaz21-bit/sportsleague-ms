import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { normalizeName } from '../common/catalog';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeagueDto } from './dto/create-league.dto';
import { CreateSeasonDto } from './dto/create-season.dto';

@Injectable()
export class LeaguesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crea la liga a nombre de quien la pide (x-user-id que envia el API Gateway).
   * Si el mismo organizador ya tiene una liga con ese nombre responde 409, salvo que
   * confirme con confirmDuplicate. Organizadores distintos si pueden usar el mismo nombre.
   */
  async create(dto: CreateLeagueDto, ownerId: number | null = null) {
    const { confirmDuplicate, ...data } = dto;
    if (ownerId && !confirmDuplicate) {
      const mine = await this.prisma.league.findMany({ where: { ownerId }, select: { name: true } });
      const twin = mine.find((l) => normalizeName(l.name) === normalizeName(data.name));
      if (twin) {
        throw new ConflictException(
          `Ya tienes una liga llamada ${twin.name}. Envie confirmDuplicate: true para crear otra con el mismo nombre`,
        );
      }
    }
    return this.prisma.league.create({ data: { ...data, ownerId } });
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

  async createSeason(leagueId: number, dto: CreateSeasonDto) {
    const league = await this.prisma.league.findUnique({ where: { id: leagueId } });
    if (!league) {
      throw new NotFoundException(`No se encontro la liga con id ${leagueId}`);
    }

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    // Restriccion del documento (3.2): start_date debe ser anterior a end_date
    if (startDate >= endDate) {
      throw new BadRequestException('startDate debe ser anterior a endDate');
    }
    // El año de la temporada corresponde a sus fechas (una temporada 2026 puede terminar en 2027)
    if (dto.year !== startDate.getUTCFullYear() && dto.year !== endDate.getUTCFullYear()) {
      throw new BadRequestException('year debe coincidir con el año de startDate o el de endDate');
    }

    return this.prisma.season.create({
      data: { leagueId, year: dto.year, startDate, endDate },
    });
  }
}
