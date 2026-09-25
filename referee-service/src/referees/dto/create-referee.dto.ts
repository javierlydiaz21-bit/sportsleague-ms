import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsIn, IsInt, IsNotEmpty, IsString } from 'class-validator';
import { DAYS } from '../../common/days';

export class CreateRefereeDto {
  @ApiProperty({ example: 'monteria-norte', description: 'Zona geografica del arbitro' })
  @IsString()
  @IsNotEmpty()
  zone: string;

  @ApiProperty({ example: [1], description: 'Ids de las categorias (League Service) en las que esta certificado' })
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  categoriesCertified: number[];

  @ApiProperty({ example: ['sabado', 'domingo'], description: `Dias disponibles: ${DAYS.join(', ')}` })
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(DAYS, { each: true })
  availability: string[];
}
