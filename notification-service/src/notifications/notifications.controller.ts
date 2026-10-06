import { Body, Controller, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { TestNotificationDto, UpdatePreferencesDto } from './dto/update-preferences.dto';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // PUT /api/v1/notifications/preferences
  @Put('preferences')
  @ApiOperation({ summary: 'Elegir los equipos que se siguen y los canales (push, email)' })
  updatePreferences(@Body() dto: UpdatePreferencesDto) {
    return this.notificationsService.updatePreferences(dto);
  }

  // POST /api/v1/notifications/test
  @Post('test')
  @ApiOperation({ summary: 'Enviar una notificacion de prueba a un usuario' })
  sendTest(@Body() dto: TestNotificationDto) {
    return this.notificationsService.sendTest(dto.userId);
  }

  // GET /api/v1/notifications/{userId}
  @Get(':userId')
  @ApiOperation({
    summary: 'Notificaciones de un usuario y sus preferencias',
    description:
      'Avisos de los equipos que sigue (horarios confirmados, cambios de sede, resultados ' +
      'finales y suspensiones). Sin equipos seguidos, muestra los avisos de toda la liga.',
  })
  @ApiParam({ name: 'userId', example: 1 })
  findForUser(@Param('userId', ParseIntPipe) userId: number) {
    return this.notificationsService.findForUser(userId);
  }
}
