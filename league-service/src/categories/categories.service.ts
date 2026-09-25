import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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

  /** Crea o reemplaza el reglamento (un solo reglamento vigente por categoria). */
  async updateRules(categoryId: number, dto: UpdateRulesDto) {
    await this.findOne(categoryId);
    return this.prisma.rule.upsert({
      where: { categoryId },
      create: { categoryId, ...dto },
      update: dto,
    });
  }
}
