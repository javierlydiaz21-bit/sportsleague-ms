import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, Max, Min } from 'class-validator';
import { TIEBREAKERS } from '../../common/catalog';

export class UpdateRulesDto {
  @ApiProperty({ example: 3, description: 'Puntos otorgados por victoria (1 a 10)' })
  @IsInt()
  @Min(1)
  @Max(10)
  pointsWin: number;

  @ApiProperty({ example: 1, description: 'Puntos otorgados por empate (0 a los puntos por victoria)' })
  @IsInt()
  @Min(0)
  @Max(10)
  pointsDraw: number;

  @ApiProperty({
    example: 'diferencia_de_goles',
    enum: TIEBREAKERS,
    description: 'Criterio de desempate en caso de igualdad de puntos (los que reconoce el Statistics Service)',
  })
  @IsIn(TIEBREAKERS, { message: 'tiebreakerCriteria debe ser diferencia_de_goles, goles_a_favor o partidos_ganados' })
  tiebreakerCriteria: string;
}
