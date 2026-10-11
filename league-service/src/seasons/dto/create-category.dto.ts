import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length, Matches } from 'class-validator';
import { trimmed } from '../../common/catalog';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Sub-17', description: 'De 1 a 40 caracteres; no se repite dentro de la liga' })
  @Transform(trimmed)
  @IsString()
  @Length(1, 40, { message: 'name debe tener de 1 a 40 caracteres' })
  name: string;

  @ApiProperty({
    example: '15-17',
    description: 'Rango de edad permitido, formato "min-max" en anios (de 3 a 99)',
  })
  @Matches(/^\d{1,2}-\d{1,2}$/, {
    message: 'ageRange debe tener el formato "min-max", por ejemplo "15-17"',
  })
  ageRange: string;
}
