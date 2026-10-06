import { Controller, Get, HttpCode, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { StatsService } from './stats.service';

@ApiTags('statistics')
@Controller()
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  // GET /api/v1/standings/{seasonId}
  @Get('standings/:seasonId')
  @ApiOperation({
    summary: 'Tabla de posiciones de una temporada',
    description: 'Ordenada por puntos y por el criterio de desempate del reglamento. Se sirve desde la cache de Redis.',
  })
  @ApiParam({ name: 'seasonId', example: 1 })
  getStandings(@Param('seasonId', ParseIntPipe) seasonId: number) {
    return this.statsService.getStandings(seasonId);
  }

  // GET /api/v1/top-scorers/{seasonId}
  @Get('top-scorers/:seasonId')
  @ApiOperation({ summary: 'Ranking de goleadores de una temporada' })
  @ApiParam({ name: 'seasonId', example: 1 })
  getTopScorers(@Param('seasonId', ParseIntPipe) seasonId: number) {
    return this.statsService.getTopScorers(seasonId);
  }

  // GET /api/v1/players/{id}/disciplinary-record
  @Get('players/:id/disciplinary-record')
  @ApiOperation({ summary: 'Tarjetas acumuladas de un jugador' })
  @ApiParam({ name: 'id', example: 1 })
  getDisciplinaryRecord(@Param('id', ParseIntPipe) id: number) {
    return this.statsService.getDisciplinaryRecord(id);
  }

  // POST /api/v1/standings/{seasonId}/recalculate
  @Post('standings/:seasonId/recalculate')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Recalcular la temporada con las actas guardadas',
    description: 'Idempotente. Util si el League Service no respondio cuando llego un acta.',
  })
  @ApiParam({ name: 'seasonId', example: 1 })
  @ApiResponse({ status: 503, description: 'League Service no disponible.' })
  recalculate(@Param('seasonId', ParseIntPipe) seasonId: number) {
    return this.statsService.recalculateSeason(seasonId);
  }
}
