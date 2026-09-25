import { Body, Controller, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
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
