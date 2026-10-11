import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, Length } from 'class-validator';
import { SPORTS, trimmed } from '../../common/catalog';

export class CreateLeagueDto {
  @ApiProperty({ example: 'Liga Municipal de Monteria', description: 'De 2 a 80 caracteres' })
  @Transform(trimmed)
  @IsString()
  @Length(2, 80, { message: 'name debe tener de 2 a 80 caracteres' })
  name: string;

  @ApiProperty({ example: 'futbol', enum: SPORTS, description: 'futbol, basquet o voley' })
  @IsIn(SPORTS, { message: 'sport debe ser futbol, basquet o voley' })
  sport: string;

  @ApiProperty({
    required: false,
    description: 'true para crearla aunque el organizador ya tenga una liga con el mismo nombre',
  })
  @IsOptional()
  @IsBoolean()
  confirmDuplicate?: boolean;
}
