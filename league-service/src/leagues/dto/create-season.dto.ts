import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsInt, Max, Min } from 'class-validator';

export class CreateSeasonDto {
  @ApiProperty({ example: 2026, description: 'Entre 2000 y 2100; debe coincidir con el año de inicio o el de fin' })
  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;

  @ApiProperty({ example: '2026-10-01' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2027-02-28' })
  @IsDateString()
  endDate: string;
}
