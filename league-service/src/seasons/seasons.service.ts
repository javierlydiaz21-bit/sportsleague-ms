import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { normalizeName } from '../common/catalog';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';

@Injectable()
export class SeasonsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crea una categoria a partir de una temporada. La tabla categories
   * guarda league_id (documento, 3.2), asi que se toma la liga a la que
   * pertenece la temporada indicada en la ruta.
   */
  async createCategory(seasonId: number, dto: CreateCategoryDto) {
    const season = await this.prisma.season.findUnique({ where: { id: seasonId } });
    if (!season) {
      throw new NotFoundException(`No se encontro la temporada con id ${seasonId}`);
    }

    const [min, max] = dto.ageRange.split('-').map(Number);
    if (min > max) {
      throw new BadRequestException('En ageRange la edad minima no puede ser mayor que la maxima');
    }
    if (min < 3) {
      throw new BadRequestException('En ageRange las edades deben estar entre 3 y 99 anios');
    }

    // El nombre no se repite dentro de la liga (sin distinguir mayusculas ni tildes)
    const siblings = await this.prisma.category.findMany({ where: { leagueId: season.leagueId }, select: { name: true } });
    if (siblings.some((c) => normalizeName(c.name) === normalizeName(dto.name))) {
      throw new ConflictException(`Ya existe la categoria ${dto.name} en esta liga`);
    }

    return this.prisma.category.create({
      data: { leagueId: season.leagueId, name: dto.name, ageRange: dto.ageRange },
    });
  }
}
