import { Body, Controller, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RefereesService } from './referees.service';
import { CreateRefereeDto } from './dto/create-referee.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';

@ApiTags('referees')
@Controller('referees')
export class RefereesController {
  constructor(private readonly refereesService: RefereesService) {}

  // POST /api/v1/referees
  @Post()
  @ApiOperation({ summary: 'Registrar un arbitro' })
  create(@Body() dto: CreateRefereeDto) {
    return this.refereesService.create(dto);
  }

  // GET /api/v1/referees — lectura de apoyo para el panel de organizadores
  @Get()
  @ApiOperation({ summary: 'Listar los arbitros registrados' })
  findAll() {
    return this.refereesService.findAll();
  }

  // GET /api/v1/referees/{id}
  @Get(':id')
  @ApiOperation({ summary: 'Consultar un arbitro (zona, certificaciones y disponibilidad)' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 404, description: 'El arbitro no existe.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.refereesService.findOne(id);
  }

  // PUT /api/v1/referees/{id}/availability
  @Put(':id/availability')
  @ApiOperation({ summary: 'Declarar la disponibilidad horaria de un arbitro' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 404, description: 'El arbitro no existe.' })
  updateAvailability(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAvailabilityDto) {
    return this.refereesService.updateAvailability(id, dto);
  }

  // GET /api/v1/referees/{id}/assignments
  @Get(':id/assignments')
  @ApiOperation({
    summary: 'Consultar las asignaciones de un arbitro',
    description: 'Incluye las asignaciones creadas automaticamente al consumir el evento ASINCRONO fixture.published.',
  })
  @ApiParam({ name: 'id', example: 1 })
  findAssignments(@Param('id', ParseIntPipe) id: number) {
    return this.refereesService.findAssignments(id);
  }
}
