import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { CreateUserDto } from '../users/dto/create-user.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * Login - Público
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  /**
   * Obtener perfil del usuario autenticado
   */
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@CurrentUser() user: any) {
    return this.authService.getProfile(user.id);
  }

  /**
   * Seed - Crear primer admin (solo funciona si no hay usuarios)
   * Este endpoint es público solo para la configuración inicial
   */
  @Public()
  @Post('setup')
  @HttpCode(HttpStatus.CREATED)
  async setup(@Body() createUserDto: CreateUserDto) {
    return this.authService.seedAdmin(
      createUserDto.email,
      createUserDto.password,
      createUserDto.firstName,
      createUserDto.lastName,
    );
  }

  /**
   * Verificar si el token es válido
   */
  @UseGuards(JwtAuthGuard)
  @Get('verify')
  async verify(@CurrentUser() user: any) {
    return { valid: true, user };
  }
}
