import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRefereeDto } from './dto/create-referee.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';

@Injectable()
export class RefereesService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateRefereeDto) {
    return this.prisma.referee.create({ data: dto });
  }

  private async ensureExists(id: number) {
    const referee = await this.prisma.referee.findUnique({ where: { id } });
    if (!referee) {
      throw new NotFoundException(`No se encontro el arbitro con id ${id}`);
    }
    return referee;
  }

  async updateAvailability(id: number, dto: UpdateAvailabilityDto) {
    await this.ensureExists(id);
    return this.prisma.referee.update({ where: { id }, data: { availability: dto.availability } });
  }

  async findAssignments(id: number) {
    await this.ensureExists(id);
    return this.prisma.refereeAssignment.findMany({
      where: { refereeId: id },
      orderBy: { matchId: 'asc' },
    });
  }
}
