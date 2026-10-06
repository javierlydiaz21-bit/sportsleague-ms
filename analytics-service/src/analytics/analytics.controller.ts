import { BadRequestException, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { EtlService } from '../etl/etl.service';
import { AnalyticsService } from './analytics.service';

const optionalId = (value?: string) => {
  if (value === undefined || value === '') return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw new BadRequestException(`"${value}" no es un id valido`);
  return n;
};

@ApiTags('analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly etl: EtlService,
  ) {}

  // GET /api/v1/analytics/attendance
  @Get('attendance')
  @ApiOperation({ summary: 'Asistencia estimada por partido' })
  @ApiQuery({ name: 'seasonId', required: false, example: 1 })
  attendance(@Query('seasonId') seasonId?: string) {
    return this.analytics.attendance(optionalId(seasonId));
  }

  // GET /api/v1/analytics/suspended-matches
  @Get('suspended-matches')
  @ApiOperation({ summary: 'Partidos suspendidos y su motivo' })
  @ApiQuery({ name: 'seasonId', required: false, example: 1 })
  suspended(@Query('seasonId') seasonId?: string) {
    return this.analytics.suspended(optionalId(seasonId));
  }

  // GET /api/v1/analytics/team-trend/{teamId}
  @Get('team-trend/:teamId')
  @ApiOperation({ summary: 'Evolucion del rendimiento de un equipo a lo largo de la temporada' })
  @ApiParam({ name: 'teamId', example: 1 })
  @ApiQuery({ name: 'seasonId', required: false, example: 1 })
  teamTrend(@Param('teamId', ParseIntPipe) teamId: number, @Query('seasonId') seasonId?: string) {
    return this.analytics.teamTrend(teamId, optionalId(seasonId));
  }

  // GET /api/v1/analytics/season-trend/{seasonId}
  @Get('season-trend/:seasonId')
  @ApiOperation({ summary: 'Evolucion del rendimiento de todos los equipos de una temporada' })
  @ApiParam({ name: 'seasonId', example: 1 })
  seasonTrend(@Param('seasonId', ParseIntPipe) seasonId: number) {
    return this.analytics.seasonTrend(seasonId);
  }

  // GET /api/v1/analytics/summary
  @Get('summary')
  @ApiOperation({ summary: 'KPIs globales de la liga y estado de la ultima corrida del ETL' })
  summary() {
    return this.analytics.summary();
  }

  // POST /api/v1/analytics/etl/run
  @Post('etl/run')
  @HttpCode(200)
  @ApiOperation({ summary: 'Ejecutar el ETL ahora, sin esperar a la siguiente corrida programada' })
  runEtl() {
    return this.etl.run();
  }
}
