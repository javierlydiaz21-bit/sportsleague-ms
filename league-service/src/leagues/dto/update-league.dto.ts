import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, Length } from 'class-validator';
import { SPORTS, trimmed } from '../../common/catalog';

/** Correccion de los datos de una liga: solo los campos que se envian cambian. */
export class UpdateLeagueDto {
  @ApiProperty({ required: false, example: 'Liga Barrial de Monteria', description: 'De 2 a 80 caracteres' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @Length(2, 80, { message: 'name debe tener de 2 a 80 caracteres' })
  name?: string;

  @ApiProperty({ required: false, enum: SPORTS, description: 'Solo mientras ninguna temporada tenga calendario' })
  @IsOptional()
  @IsIn(SPORTS, { message: 'sport debe ser futbol, basquet o voley' })
  sport?: string;

  @ApiProperty({ required: false, description: 'true para usar un nombre que el organizador ya tiene en otra liga' })
  @IsOptional()
  @IsBoolean()
  confirmDuplicate?: boolean;
}
