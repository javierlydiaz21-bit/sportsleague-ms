import { Body, Controller, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SeasonsService } from './seasons.service';
import { CreateCategoryDto } from './dto/create-category.dto';

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
}
