import { Body, Controller, Get, Headers, Param, ParseIntPipe, Patch, Put } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { userIdOf } from '../common/ownership';
import { CategoriesService } from './categories.service';
import { UpdateCategoryDto } from './dto/update-category.dto';
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
  @ApiResponse({ status: 403, description: 'La liga es de otro organizador.' })
  updateRules(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRulesDto, @Headers('x-user-id') userId?: string) {
    return this.categoriesService.updateRules(id, dto, userIdOf(userId));
  }

  // PATCH /api/v1/categories/{id} — corregir nombre o rango de edad
  @Patch(':id')
  @ApiOperation({
    summary: 'Corregir el nombre o el rango de edad de una categoria',
    description: 'Si cambia el rango de edad, la respuesta trae ageRangeChanged: true para recalcular la elegibilidad en el Team Service.',
  })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 403, description: 'La liga es de otro organizador.' })
  @ApiResponse({ status: 409, description: 'Ya existe una categoria con ese nombre en la liga.' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCategoryDto, @Headers('x-user-id') userId?: string) {
    return this.categoriesService.update(id, dto, userIdOf(userId));
  }
}
