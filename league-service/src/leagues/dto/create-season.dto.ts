import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsInt, Min } from 'class-validator';

export class CreateSeasonDto {
  @ApiProperty({ example: 2026 })
  @IsInt()
  @Min(2000)
  year: number;

  @ApiProperty({ example: '2026-10-01' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2027-02-28' })
  @IsDateString()
  endDate: string;
}
