import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString } from 'class-validator';

export class CreateTeamDto {
  @ApiProperty({ example: 'Halcones FC' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 1, description: 'Id de la categoria en el League Service' })
  @IsInt()
  categoryId: number;
}
