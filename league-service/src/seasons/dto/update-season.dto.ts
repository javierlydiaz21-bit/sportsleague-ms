import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Correccion de una temporada: solo los campos que se envian cambian. Si ya tiene
 * calendario, las fechas nuevas deben seguir cubriendo todos sus partidos.
 */
export class UpdateSeasonDto {
  @ApiProperty({ required: false, example: 2026 })
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @ApiProperty({ required: false, example: '2026-10-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ required: false, example: '2027-02-28' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
