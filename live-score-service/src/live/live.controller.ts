import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { LiveStatus } from '@prisma/client';
import { LiveService } from './live.service';
import { RegisterEventDto } from './dto/register-event.dto';
import { SuspendMatchDto } from './dto/suspend-match.dto';

@ApiTags('matches')
@Controller()
export class LiveController {
  constructor(private readonly liveService: LiveService) {}

  // POST /api/v1/matches/{id}/events
  @Post('matches/:id/events')
  @ApiOperation({
    summary: 'Registrar un evento en vivo (gol, tarjeta o sustitucion)',
    description:
      'Actualiza el marcador, publica el evento ASINCRONO match.event y lo difunde por ' +
      'WebSocket a los espectadores conectados. Si el partido ya finalizo, corrige el acta.',
  })
  @ApiParam({ name: 'id', example: 1, description: 'Id del partido (Fixture Service)' })
  @ApiResponse({ status: 400, description: 'Datos invalidos o el equipo no juega este partido.' })
  @ApiResponse({ status: 404, description: 'El partido no existe.' })
  @ApiResponse({ status: 409, description: 'El partido esta suspendido.' })
  registerEvent(@Param('id', ParseIntPipe) id: number, @Body() dto: RegisterEventDto) {
    return this.liveService.registerEvent(id, dto);
  }

  // DELETE /api/v1/matches/{id}/events/{eventId}
  @Delete('matches/:id/events/:eventId')
  @ApiOperation({ summary: 'Anular un evento registrado por error' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiParam({ name: 'eventId', example: 1 })
  annulEvent(@Param('id', ParseIntPipe) id: number, @Param('eventId', ParseIntPipe) eventId: number) {
    return this.liveService.annulEvent(id, eventId);
  }

  // GET /api/v1/matches/{id}/live
  @Get('matches/:id/live')
  @ApiOperation({ summary: 'Marcador y linea de tiempo del partido' })
  @ApiParam({ name: 'id', example: 1 })
  getLive(@Param('id', ParseIntPipe) id: number) {
    return this.liveService.getLive(id);
  }

  // POST /api/v1/matches/{id}/complete
  @Post('matches/:id/complete')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Finalizar el partido',
    description:
      'Publica el evento ASINCRONO match.completed con el acta (resultado y eventos). ' +
      'Si el partido ya estaba cerrado, reenvia el acta (idempotente).',
  })
  @ApiParam({ name: 'id', example: 1 })
  complete(@Param('id', ParseIntPipe) id: number) {
    return this.liveService.complete(id);
  }

  // POST /api/v1/matches/{id}/suspend
  @Post('matches/:id/suspend')
  @HttpCode(200)
  @ApiOperation({ summary: 'Suspender el partido', description: 'Publica el evento ASINCRONO match.suspended.' })
  @ApiParam({ name: 'id', example: 1 })
  suspend(@Param('id', ParseIntPipe) id: number, @Body() dto: SuspendMatchDto) {
    return this.liveService.suspend(id, dto.reason);
  }

  // GET /api/v1/live-matches?status=en_curso
  @Get('live-matches')
  @ApiOperation({ summary: 'Partidos por estado (por defecto, los que se juegan ahora)' })
  @ApiQuery({ name: 'status', required: false, enum: LiveStatus })
  listByStatus(@Query('status') status: string = LiveStatus.en_curso) {
    if (!(Object.values(LiveStatus) as string[]).includes(status)) {
      throw new BadRequestException(`status debe ser uno de: ${Object.values(LiveStatus).join(', ')}`);
    }
    return this.liveService.listByStatus(status as LiveStatus);
  }
}
