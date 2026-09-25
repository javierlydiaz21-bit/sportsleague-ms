import { Body, Controller, Get, Param, ParseIntPipe, Put } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { UpdateRulesDto } from './dto/update-rules.dto';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  // GET /api/v1/categories/{id} — lectura de apoyo: la consulta REST puntual
  // que hace el Team Service para leer age_range (documento, 3.2 y 3.8).
  @Get(':id')
  @ApiOperation({
    summary: 'Consultar una categoria (incluye age_range)',
    description: 'Consultado de forma SINCRONA (REST) por el Team Service para validar la elegibilidad de un jugador.',
  })
  @ApiParam({ name: 'id', example: 1 })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.categoriesService.findOne(id);
  }

  // GET /api/v1/categories/{id}/rules
  @Get(':id/rules')
  @ApiOperation({ summary: 'Consultar el reglamento de una categoria' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 404, description: 'La categoria no existe o no tiene reglamento.' })
  getRules(@Param('id', ParseIntPipe) id: number) {
    return this.categoriesService.getRules(id);
  }

  // PUT /api/v1/categories/{id}/rules
  @Put(':id/rules')
  @ApiOperation({ summary: 'Definir o actualizar el reglamento de una categoria' })
  @ApiParam({ name: 'id', example: 1 })
  updateRules(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRulesDto) {
    return this.categoriesService.updateRules(id, dto);
  }
}
