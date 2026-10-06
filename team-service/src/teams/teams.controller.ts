import { BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TeamsService } from './teams.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { CreatePlayerDto } from './dto/create-player.dto';

@ApiTags('teams')
@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  // POST /api/v1/teams
  @Post()
  @ApiOperation({ summary: 'Registrar un equipo' })
  create(@Body() dto: CreateTeamDto) {
    return this.teamsService.create(dto);
  }

  // GET /api/v1/teams?categoryId=1 o ?ids=1,2,3 — lectura de apoyo para la web
  @Get()
  @ApiOperation({ summary: 'Listar equipos (con su plantilla) por categoria o por ids' })
  @ApiQuery({ name: 'categoryId', required: false, example: 1 })
  @ApiQuery({ name: 'ids', required: false, example: '1,2,3' })
  findMany(@Query('categoryId') categoryId?: string, @Query('ids') ids?: string) {
    const toInt = (v: string) => {
      const n = Number(v);
      if (!Number.isInteger(n)) throw new BadRequestException(`"${v}" no es un id valido`);
      return n;
    };
    if (categoryId === undefined && ids === undefined) {
      throw new BadRequestException('Indique categoryId o ids');
    }
    return this.teamsService.findMany({
      categoryId: categoryId !== undefined ? toInt(categoryId) : undefined,
      ids: ids !== undefined ? ids.split(',').filter(Boolean).map(toInt) : undefined,
    });
  }

  // GET /api/v1/teams/{id}
  @Get(':id')
  @ApiOperation({ summary: 'Consultar un equipo' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 404, description: 'El equipo no existe.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.teamsService.findOne(id);
  }

  // POST /api/v1/teams/{id}/players
  @Post(':id/players')
  @ApiTags('players')
  @ApiOperation({
    summary: 'Fichar un jugador en el equipo',
    description:
      'Valida automaticamente la elegibilidad consultando de forma SINCRONA (REST) ' +
      'el age_range de la categoria del equipo en el League Service.',
  })
  @ApiParam({ name: 'id', example: 1 })
  addPlayer(@Param('id', ParseIntPipe) id: number, @Body() dto: CreatePlayerDto) {
    return this.teamsService.addPlayer(id, dto);
  }

  // GET /api/v1/teams/{id}/players
  @Get(':id/players')
  @ApiTags('players')
  @ApiOperation({ summary: 'Consultar la plantilla de un equipo' })
  @ApiParam({ name: 'id', example: 1 })
  findPlayers(@Param('id', ParseIntPipe) id: number) {
    return this.teamsService.findPlayers(id);
  }
}

@ApiTags('players')
@Controller('players')
export class PlayersController {
  constructor(private readonly teamsService: TeamsService) {}

  // PUT /api/v1/players/{id}/eligibility
  @Put(':id/eligibility')
  @ApiOperation({
    summary: 'Verificar de nuevo la elegibilidad de un jugador',
    description: 'Recalcula la elegibilidad contra el age_range vigente de su categoria (consulta SINCRONA al League Service).',
  })
  @ApiParam({ name: 'id', example: 1 })
  verifyEligibility(@Param('id', ParseIntPipe) id: number) {
    return this.teamsService.verifyEligibility(id);
  }
}
