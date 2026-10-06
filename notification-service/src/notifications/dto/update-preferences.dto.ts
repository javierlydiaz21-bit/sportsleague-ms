import { ApiProperty } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsIn, IsInt, Min } from 'class-validator';

export const CHANNELS = ['push', 'email'];

export class UpdatePreferencesDto {
  @ApiProperty({ example: 3, description: 'Usuario (API Gateway)' })
  @IsInt()
  @Min(1)
  userId: number;

  @ApiProperty({ example: [1, 2], description: 'Equipos que sigue el usuario (Team Service)' })
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  followedTeams: number[];

  @ApiProperty({ example: ['push'], description: `Canales: ${CHANNELS.join(', ')}` })
  @IsArray()
  @ArrayUnique()
  @IsIn(CHANNELS, { each: true })
  channels: string[];
}

export class TestNotificationDto {
  @ApiProperty({ example: 3, description: 'Usuario que recibe la notificacion de prueba' })
  @IsInt()
  @Min(1)
  userId: number;
}
