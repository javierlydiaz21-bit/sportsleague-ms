import { Body, Controller, Get, Headers, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { userIdOf } from '../common/ownership';
import { LeaguesService } from './leagues.service';
import { CreateLeagueDto } from './dto/create-league.dto';
import { CreateSeasonDto } from './dto/create-season.dto';
import { UpdateLeagueDto } from './dto/update-league.dto';

export { userIdOf };

@ApiTags('leagues')
@Controller('leagues')
export class LeaguesController {
  constructor(private readonly leaguesService: LeaguesService) {}

  // POST /api/v1/leagues — la liga queda a nombre del usuario que la crea
  @Post()
  @ApiOperation({ summary: 'Crear una liga' })
  @ApiHeader({ name: 'x-user-id', required: false, description: 'Usuario autenticado (lo agrega el API Gateway)' })
  @ApiResponse({ status: 201, description: 'Liga creada.' })
  create(@Body() dto: CreateLeagueDto, @Headers('x-user-id') userId?: string) {
    return this.leaguesService.create(dto, userIdOf(userId));
  }

  // GET /api/v1/leagues — lectura de apoyo para la web: ligas con sus temporadas y categorias
  @Get()
  @ApiOperation({ summary: 'Listar las ligas con sus temporadas y categorias' })
  findAll() {
    return this.leaguesService.findAll();
  }

  // GET /api/v1/leagues/mine — "Mis ligas": solo las creadas por el usuario (va antes de :id)
  @Get('mine')
  @ApiOperation({ summary: 'Listar las ligas del organizador autenticado' })
  @ApiHeader({ name: 'x-user-id', required: true, description: 'Usuario autenticado (lo agrega el API Gateway)' })
  @ApiResponse({ status: 400, description: 'Falta el usuario.' })
  findMine(@Headers('x-user-id') userId?: string) {
    return this.leaguesService.findMine(userIdOf(userId));
  }

  // GET /api/v1/leagues/{id}
  @Get(':id')
  @ApiOperation({ summary: 'Consultar una liga con sus temporadas y categorias' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 404, description: 'La liga no existe.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.leaguesService.findOne(id);
  }

  // PATCH /api/v1/leagues/{id} — corregir nombre o deporte (solo el organizador que la creo)
  @Patch(':id')
  @ApiOperation({ summary: 'Corregir el nombre o el deporte de una liga' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 403, description: 'La liga es de otro organizador.' })
  @ApiResponse({ status: 409, description: 'Nombre repetido del mismo organizador, o deporte con calendario ya generado.' })
  @ApiResponse({ status: 503, description: 'No se pudo consultar el calendario en el Fixture Service.' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateLeagueDto, @Headers('x-user-id') userId?: string) {
    return this.leaguesService.update(id, dto, userIdOf(userId));
  }

  // POST /api/v1/leagues/{id}/seasons
  @Post(':id/seasons')
  @ApiOperation({ summary: 'Crear una temporada dentro de una liga' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 400, description: 'startDate no es anterior a endDate.' })
  @ApiResponse({ status: 404, description: 'La liga no existe.' })
  createSeason(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateSeasonDto) {
    return this.leaguesService.createSeason(id, dto);
  }
}
