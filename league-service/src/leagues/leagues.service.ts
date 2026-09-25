import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeagueDto } from './dto/create-league.dto';
import { CreateSeasonDto } from './dto/create-season.dto';

@Injectable()
export class LeaguesService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateLeagueDto) {
    return this.prisma.league.create({ data: dto });
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

    return this.prisma.season.create({
      data: { leagueId, year: dto.year, startDate, endDate },
    });
  }
}
