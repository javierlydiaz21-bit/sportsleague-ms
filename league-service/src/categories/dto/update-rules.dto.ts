import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class UpdateRulesDto {
  @ApiProperty({ example: 3, description: 'Puntos otorgados por victoria' })
  @IsInt()
  @Min(0)
  pointsWin: number;

  @ApiProperty({ example: 1, description: 'Puntos otorgados por empate' })
  @IsInt()
  @Min(0)
  pointsDraw: number;

  @ApiProperty({
    example: 'diferencia_de_goles',
    description: 'Criterio de desempate en caso de igualdad de puntos',
  })
  @IsString()
  @IsNotEmpty()
  tiebreakerCriteria: string;
}
