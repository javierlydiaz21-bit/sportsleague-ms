import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsIn } from 'class-validator';
import { DAYS } from '../../common/days';

export class UpdateAvailabilityDto {
  @ApiProperty({ example: ['sabado'], description: `Dias disponibles: ${DAYS.join(', ')}` })
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(DAYS, { each: true })
  availability: string[];
}
