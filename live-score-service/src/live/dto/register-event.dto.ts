import { ApiProperty } from '@nestjs/swagger';
import { EventType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export class RegisterEventDto {
  @ApiProperty({ enum: EventType, example: 'gol', description: 'gol, tarjeta_amarilla, tarjeta_roja o sustitucion' })
  @IsEnum(EventType, { message: 'type debe ser gol, tarjeta_amarilla, tarjeta_roja o sustitucion' })
  type: EventType;

  // Validacion (10.8): minutos de partido dentro de un rango razonable
  @ApiProperty({ example: 23, description: 'Minuto del partido (0 a 130)' })
  @IsInt()
  @Min(0)
  @Max(130)
  minute: number;

  @ApiProperty({ example: 1, description: 'Equipo (Team Service): debe ser el local o el visitante del partido' })
  @IsInt()
  teamId: number;

  @ApiProperty({ example: 1, required: false, description: 'Jugador (Team Service) que protagoniza el evento' })
  @IsOptional()
  @IsInt()
  playerId?: number;
}
