import { Controller, Get, Param, ParseIntPipe, Put } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AssignmentsService } from './assignments.service';

@ApiTags('assignments')
@Controller('assignments')
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  // GET /api/v1/assignments/{id} — uso interno del API Gateway (no tiene ruta publica)
  @Get(':id')
  @ApiOperation({ summary: 'Asignacion con su partido (uso interno del API Gateway)' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 404, description: 'La asignacion no existe.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.assignmentsService.findOne(id);
  }

  // PUT /api/v1/assignments/{id}/confirm
  @Put(':id/confirm')
  @ApiOperation({ summary: 'El arbitro confirma su asignacion' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 404, description: 'La asignacion no existe.' })
  confirm(@Param('id', ParseIntPipe) id: number) {
    return this.assignmentsService.confirm(id);
  }
}
