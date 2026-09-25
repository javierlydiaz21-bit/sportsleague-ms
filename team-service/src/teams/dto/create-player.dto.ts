import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsInt, Min } from 'class-validator';

export class CreatePlayerDto {
  @ApiProperty({ example: '2010-05-14', description: 'Fecha de nacimiento' })
  @IsDateString()
  birthDate: string;

  @ApiProperty({ example: 10, description: 'Numero de camiseta' })
  @IsInt()
  @Min(1)
  jerseyNumber: number;
}
