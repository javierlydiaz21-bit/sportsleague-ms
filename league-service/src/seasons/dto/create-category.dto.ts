import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Sub-17' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: '15-17',
    description: 'Rango de edad permitido, formato "min-max" en anios',
  })
  @Matches(/^\d{1,2}-\d{1,2}$/, {
    message: 'ageRange debe tener el formato "min-max", por ejemplo "15-17"',
  })
  ageRange: string;
}
