import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class AssignOwnerDto {
  @ApiProperty({ example: 1, description: 'Id del usuario organizador (API Gateway) que sera propietario' })
  @IsInt()
  @Min(1)
  ownerId: number;
}
