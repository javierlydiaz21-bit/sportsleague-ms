import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthGuard, Roles } from './auth.guard';
import { AuthService, AuthUser } from './auth.service';
import { CreateUserDto, LoginDto, RefreshDto, RegisterDto } from './dto/auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // POST /api/v1/auth/register
  @Post('register')
  @ApiOperation({ summary: 'Crear una cuenta de espectador' })
  @ApiResponse({ status: 409, description: 'El correo ya esta registrado.' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // POST /api/v1/auth/login
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Iniciar sesion: devuelve el access token (JWT) y el refresh token' })
  @ApiResponse({ status: 401, description: 'Correo o contrasena incorrectos.' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // POST /api/v1/auth/refresh
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Renovar el access token sin volver a iniciar sesion (rota el refresh token)' })
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  // POST /api/v1/auth/logout
  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cerrar sesion: invalida el refresh token' })
  logout(@Body() dto: RefreshDto) {
    return this.authService.logout(dto.refreshToken);
  }

  // GET /api/v1/auth/me
  @Get('me')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Usuario de la sesion actual' })
  me(@Req() req: { user: AuthUser }) {
    return this.authService.me(req.user.sub);
  }

  // POST /api/v1/auth/users
  @Post('users')
  @UseGuards(AuthGuard)
  @Roles(Role.organizador)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear una cuenta (organizador): por ejemplo, la de un arbitro' })
  createUser(@Body() dto: CreateUserDto) {
    return this.authService.createUser(dto);
  }

  // GET /api/v1/auth/users
  @Get('users')
  @UseGuards(AuthGuard)
  @Roles(Role.organizador)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar las cuentas (organizador)' })
  listUsers() {
    return this.authService.listUsers();
  }
}
