import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { LeaguesService } from './leagues.service';
import { CreateLeagueDto } from './dto/create-league.dto';
import { CreateSeasonDto } from './dto/create-season.dto';

@ApiTags('leagues')
@Controller('leagues')
export class LeaguesController {
  constructor(private readonly leaguesService: LeaguesService) {}

  // POST /api/v1/leagues
  @Post()
  @ApiOperation({ summary: 'Crear una liga' })
  @ApiResponse({ status: 201, description: 'Liga creada.' })
  create(@Body() dto: CreateLeagueDto) {
    return this.leaguesService.create(dto);
  }

  // GET /api/v1/leagues — lectura de apoyo para la web: ligas con sus temporadas y categorias
  @Get()
  @ApiOperation({ summary: 'Listar las ligas con sus temporadas y categorias' })
  findAll() {
    return this.leaguesService.findAll();
  }

  // GET /api/v1/leagues/{id}
  @Get(':id')
  @ApiOperation({ summary: 'Consultar una liga con sus temporadas y categorias' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 404, description: 'La liga no existe.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.leaguesService.findOne(id);
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
