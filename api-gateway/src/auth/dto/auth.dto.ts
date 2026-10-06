import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsEmail, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@sportsleague.co' })
  @IsEmail({}, { message: 'email no es un correo valido' })
  email: string;

  @ApiProperty({ example: 'admin12345' })
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class RegisterDto {
  @ApiProperty({ example: 'Ana Gomez' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;

  @ApiProperty({ example: 'ana@correo.com' })
  @IsEmail({}, { message: 'email no es un correo valido' })
  email: string;

  @ApiProperty({ example: 'clave-segura', description: 'Minimo 8 caracteres' })
  @IsString()
  @MinLength(8, { message: 'La contrasena debe tener al menos 8 caracteres' })
  @MaxLength(72) // limite de bcrypt
  password: string;
}

export class CreateUserDto extends RegisterDto {
  @ApiProperty({ enum: Role, example: 'arbitro' })
  @IsEnum(Role, { message: 'role debe ser organizador, arbitro o espectador' })
  role: Role;

  @ApiProperty({ required: false, example: 1, description: 'Obligatorio para el rol arbitro: su id en el Referee Service' })
  @IsOptional()
  @IsInt()
  refereeId?: number;
}

export class RefreshDto {
  @ApiProperty({ description: 'Refresh token recibido al iniciar sesion' })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
