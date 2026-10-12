import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { FixtureClientService } from '../clients/fixture-client.service';
import { ageRangeError, dayOf, normalizeName, seasonError } from '../common/catalog';
import { Actor, assertCanEdit } from '../common/ownership';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateSeasonDto } from './dto/update-season.dto';

@Injectable()
export class SeasonsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fixtures: FixtureClientService,
  ) {}

  /**
   * Crea una categoria a partir de una temporada. La tabla categories
   * guarda league_id (documento, 3.2), asi que se toma la liga a la que
   * pertenece la temporada indicada en la ruta.
   */
  async createCategory(seasonId: number, dto: CreateCategoryDto, actor: Actor) {
    const season = await this.prisma.season.findUnique({ where: { id: seasonId }, include: { league: true } });
    if (!season) {
      throw new NotFoundException(`No se encontro la temporada con id ${seasonId}`);
    }
    assertCanEdit(season.league, actor);

    const rangeError = ageRangeError(dto.ageRange);
    if (rangeError) throw new BadRequestException(rangeError);

    // El nombre no se repite dentro de la liga (sin distinguir mayusculas ni tildes)
    const siblings = await this.prisma.category.findMany({ where: { leagueId: season.leagueId }, select: { name: true } });
    if (siblings.some((c) => normalizeName(c.name) === normalizeName(dto.name))) {
      throw new ConflictException(`Ya existe la categoria ${dto.name} en esta liga`);
    }

    return this.prisma.category.create({
      data: { leagueId: season.leagueId, name: dto.name, ageRange: dto.ageRange },
    });
  }

  /**
   * PATCH /seasons/{id}: corrige el año o las fechas. Si la temporada ya tiene calendario,
   * las fechas nuevas deben seguir cubriendo todos sus partidos; si no, responde 409 sin cambiar nada.
   */
  async update(id: number, dto: UpdateSeasonDto, actor: Actor) {
    const season = await this.prisma.season.findUnique({ where: { id }, include: { league: true } });
    if (!season) {
      throw new NotFoundException(`No se encontro la temporada con id ${id}`);
    }
    assertCanEdit(season.league, actor);

    const year = dto.year ?? season.year;
    const startDate = dto.startDate ? new Date(dto.startDate) : season.startDate;
    const endDate = dto.endDate ? new Date(dto.endDate) : season.endDate;
    const error = seasonError(year, startDate, endDate);
    if (error) throw new BadRequestException(error);

    const datesChanged = dayOf(startDate) !== dayOf(season.startDate) || dayOf(endDate) !== dayOf(season.endDate);
    if (datesChanged) {
      const from = dayOf(startDate);
      const to = dayOf(endDate);
      const outside = (await this.fixtures.matchesOf(id)).filter((m) => dayOf(m.scheduledAt) < from || dayOf(m.scheduledAt) > to);
      if (outside.length) {
        const days = outside.map((m) => dayOf(m.scheduledAt)).sort();
        throw new ConflictException(
          `${outside.length} partidos del calendario quedarian fuera de las nuevas fechas (entre ${days[0]} y ${days[days.length - 1]}). ` +
            'Ajuste las fechas para que incluyan todo el calendario',
        );
      }
    }

    return this.prisma.season.update({ where: { id }, data: { year, startDate, endDate } });
  }
}
