import { Body, Controller, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FixturesService } from './fixtures.service';
import { GenerateFixtureDto } from './dto/generate-fixture.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';

@ApiTags('fixtures')
@Controller()
export class FixturesController {
  constructor(private readonly fixturesService: FixturesService) {}

  // POST /api/v1/seasons/{id}/fixtures/generate
  @Post('seasons/:id/fixtures/generate')
  @ApiOperation({
    summary: 'Generar el calendario de una temporada',
    description:
      'Consulta de forma SINCRONA el reglamento de la categoria al League Service y valida ' +
      'los equipos participantes en el Team Service. Genera el calendario respetando las ' +
      'canchas disponibles, el descanso minimo y el equilibrio local/visitante, y publica ' +
      'el evento ASINCRONO fixture.published por cada jornada confirmada.',
  })
  @ApiParam({ name: 'id', example: 1, description: 'Id de la temporada (League Service)' })
  @ApiResponse({ status: 201, description: 'Calendario generado y publicado.' })
  @ApiResponse({ status: 400, description: 'Categoria sin reglamento, equipo inexistente o datos invalidos.' })
  @ApiResponse({ status: 409, description: 'La temporada ya tiene calendario.' })
  @ApiResponse({ status: 503, description: 'League Service o Team Service no disponible.' })
  generate(@Param('id', ParseIntPipe) id: number, @Body() dto: GenerateFixtureDto) {
    return this.fixturesService.generate(id, dto);
  }

  // GET /api/v1/fixtures/{seasonId}
  @Get('fixtures/:seasonId')
  @ApiOperation({ summary: 'Consultar el calendario de una temporada' })
  @ApiParam({ name: 'seasonId', example: 1 })
  findBySeason(@Param('seasonId', ParseIntPipe) seasonId: number) {
    return this.fixturesService.findBySeason(seasonId);
  }

  // GET /api/v1/matches/{id}
  @Get('matches/:id')
  @ApiTags('matches')
  @ApiOperation({ summary: 'Consultar un partido' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 404, description: 'El partido no existe.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.fixturesService.findOne(id);
  }

  // PUT /api/v1/matches/{id}/venue
  @Put('matches/:id/venue')
  @ApiTags('matches')
  @ApiOperation({ summary: 'Cambiar la sede de un partido' })
  @ApiParam({ name: 'id', example: 1 })
  updateVenue(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateVenueDto) {
    return this.fixturesService.updateVenue(id, dto);
  }
}
