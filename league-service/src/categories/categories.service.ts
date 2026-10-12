import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ageRangeError, normalizeName } from '../common/catalog';
import { Actor, assertCanEdit } from '../common/ownership';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UpdateRulesDto } from './dto/update-rules.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(id: number) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException(`No se encontro la categoria con id ${id}`);
    }
    return category;
  }

  async getRules(categoryId: number) {
    await this.findOne(categoryId);
    const rule = await this.prisma.rule.findUnique({ where: { categoryId } });
    if (!rule) {
      throw new NotFoundException(
        `La categoria ${categoryId} aun no tiene reglamento. Definalo con PUT /categories/${categoryId}/rules`,
      );
    }
    return rule;
  }

  /** Categoria con su liga, para comprobar quien puede editarla. */
  private async withLeague(id: number) {
    const category = await this.prisma.category.findUnique({ where: { id }, include: { league: true } });
    if (!category) {
      throw new NotFoundException(`No se encontro la categoria con id ${id}`);
    }
    return category;
  }

  /**
   * PATCH /categories/{id}: corrige el nombre o el rango de edad. El nombre no se repite en la
   * liga. Si cambia el rango, la elegibilidad de los jugadores se recalcula en el Team Service
   * (la web muestra antes el impacto con GET /categories/{id}/eligibility-preview).
   */
  async update(id: number, dto: UpdateCategoryDto, actor: Actor) {
    const category = await this.withLeague(id);
    assertCanEdit(category.league, actor);

    if (dto.name !== undefined && normalizeName(dto.name) !== normalizeName(category.name)) {
      const siblings = await this.prisma.category.findMany({ where: { leagueId: category.leagueId }, select: { id: true, name: true } });
      if (siblings.some((c) => c.id !== id && normalizeName(c.name) === normalizeName(dto.name!))) {
        throw new ConflictException(`Ya existe la categoria ${dto.name} en esta liga`);
      }
    }
    if (dto.ageRange !== undefined) {
      const rangeError = ageRangeError(dto.ageRange);
      if (rangeError) throw new BadRequestException(rangeError);
    }

    const updated = await this.prisma.category.update({
      where: { id },
      data: { ...(dto.name !== undefined && { name: dto.name }), ...(dto.ageRange !== undefined && { ageRange: dto.ageRange }) },
    });
    // La web usa esta marca para pedir al Team Service que recalcule la elegibilidad
    return { ...updated, ageRangeChanged: dto.ageRange !== undefined && dto.ageRange !== category.ageRange };
  }

  /** Crea o reemplaza el reglamento (un solo reglamento vigente por categoria). */
  async updateRules(categoryId: number, dto: UpdateRulesDto, actor: Actor) {
    if (dto.pointsDraw > dto.pointsWin) {
      throw new BadRequestException('pointsDraw no puede ser mayor que pointsWin');
    }
    const category = await this.withLeague(categoryId);
    assertCanEdit(category.league, actor);
    return this.prisma.rule.upsert({
      where: { categoryId },
      create: { categoryId, ...dto },
      update: dto,
    });
  }
}
