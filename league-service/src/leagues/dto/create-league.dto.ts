import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateLeagueDto {
  @ApiProperty({ example: 'Liga Municipal de Monteria' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'futbol', description: 'futbol, basquet o voley' })
  @IsString()
  @IsNotEmpty()
  sport: string;
}
