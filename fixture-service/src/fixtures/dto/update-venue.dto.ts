import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateVenueDto {
  @ApiProperty({ example: 'Cancha Municipal 3' })
  @IsString()
  @IsNotEmpty()
  venue: string;
}
