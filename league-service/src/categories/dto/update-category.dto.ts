import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length, Matches } from 'class-validator';
import { trimmed } from '../../common/catalog';

/**
 * Correccion de una categoria: solo los campos que se envian cambian. Si cambia el rango
 * de edad, la web muestra antes que jugadores cambiarian de elegibilidad (Team Service) y
 * despues pide recalcularla.
 */
export class UpdateCategoryDto {
  @ApiProperty({ required: false, example: 'Sub-17', description: 'De 1 a 40 caracteres; no se repite dentro de la liga' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @Length(1, 40, { message: 'name debe tener de 1 a 40 caracteres' })
  name?: string;

  @ApiProperty({ required: false, example: '15-17', description: 'Formato "min-max" en anios (de 3 a 99)' })
  @IsOptional()
  @Matches(/^\d{1,2}-\d{1,2}$/, { message: 'ageRange debe tener el formato "min-max", por ejemplo "15-17"' })
  ageRange?: string;
}
