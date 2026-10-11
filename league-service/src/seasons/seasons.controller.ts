import { Body, Controller, Headers, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { userIdOf } from '../common/ownership';
import { SeasonsService } from './seasons.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateSeasonDto } from './dto/update-season.dto';

@ApiTags('seasons')
@Controller('seasons')
export class SeasonsController {
  constructor(private readonly seasonsService: SeasonsService) {}

  // POST /api/v1/seasons/{id}/categories
  @Post(':id/categories')
  @ApiOperation({
    summary: 'Crear una categoria en la liga de una temporada',
    description: 'Registra la categoria con su rango de edad (age_range), usado por el Team Service para validar la elegibilidad.',
  })
  @ApiParam({ name: 'id', example: 1, description: 'Id de la temporada' })
  @ApiResponse({ status: 404, description: 'La temporada no existe.' })
  createCategory(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateCategoryDto) {
    return this.seasonsService.createCategory(id, dto);
  }

  // PATCH /api/v1/seasons/{id} — corregir año o fechas sin dejar partidos fuera de la temporada
  @Patch(':id')
  @ApiOperation({
    summary: 'Corregir el año o las fechas de una temporada',
    description: 'Si la temporada ya tiene calendario (Fixture Service), las fechas nuevas deben cubrir todos sus partidos.',
  })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 403, description: 'La liga es de otro organizador.' })
  @ApiResponse({ status: 409, description: 'Las fechas nuevas dejarian partidos fuera de la temporada.' })
  @ApiResponse({ status: 503, description: 'No se pudo consultar el calendario en el Fixture Service.' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSeasonDto, @Headers('x-user-id') userId?: string) {
    return this.seasonsService.update(id, dto, userIdOf(userId));
  }
}
