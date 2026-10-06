import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreatePlayerDto {
  @ApiProperty({ example: 'Juan Perez', required: false, description: 'Nombre del jugador' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiProperty({ example: '2010-05-14', description: 'Fecha de nacimiento' })
  @IsDateString()
  birthDate: string;

  @ApiProperty({ example: 10, description: 'Numero de camiseta' })
  @IsInt()
  @Min(1)
  jerseyNumber: number;
}
