import { Body, Controller, Param, ParseIntPipe, Post } from '@nestjs/common';
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
