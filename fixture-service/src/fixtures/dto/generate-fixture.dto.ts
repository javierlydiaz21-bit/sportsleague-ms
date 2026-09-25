import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class GenerateFixtureDto {
  @ApiProperty({ example: 1, description: 'Categoria (League Service) cuyo reglamento se consulta' })
  @IsInt()
  categoryId: number;

  @ApiProperty({ example: 'monteria-norte', description: 'Zona geografica de las sedes (para asignar arbitros)' })
  @IsString()
  @IsNotEmpty()
  zone: string;

  @ApiProperty({ example: [1, 2, 3, 4], description: 'Equipos participantes (Team Service)' })
  @IsArray()
  @ArrayMinSize(2, { message: 'Se requieren al menos 2 equipos' })
  @ArrayUnique({ message: 'No se puede repetir un equipo' })
  @IsInt({ each: true })
  teamIds: number[];

  @ApiProperty({ example: ['Cancha Municipal 1', 'Cancha Municipal 2'], description: 'Canchas disponibles' })
  @IsArray()
  @ArrayMinSize(1, { message: 'Se requiere al menos una cancha disponible' })
  @IsString({ each: true })
  venues: string[];

  @ApiProperty({ example: '2026-10-03', description: 'Fecha de la primera jornada' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ required: false, default: 3, description: 'Descanso minimo (dias) entre partidos de un mismo equipo' })
  @IsOptional()
  @IsInt()
  @Min(1)
  restDaysMin?: number = 3;

  @ApiProperty({ required: false, default: 7, description: 'Dias entre una jornada y la siguiente' })
  @IsOptional()
  @IsInt()
  @Min(1)
  daysBetweenRounds?: number = 7;
}
