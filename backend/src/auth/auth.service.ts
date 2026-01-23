import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    
    if (!user) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      return null;
    }

    if (!user.isActive) {
      return null;
    }

    const { password: _, ...result } = user;
    return result;
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Actualizar último login
    await this.usersService.updateLastLogin(user.id);

    const payload = { sub: user.id, email: user.email };

    this.logger.log(`Usuario ${user.email} ha iniciado sesión`);

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    };
  }

  async getProfile(userId: string) {
    return this.usersService.findOne(userId);
  }

  /**
   * Crear el primer usuario admin si no existe ninguno
   */
  async seedAdmin(email: string, password: string, firstName: string, lastName: string) {
    const userCount = await this.usersService.countUsers();
    
    if (userCount > 0) {
      throw new UnauthorizedException('Ya existe al menos un usuario. Use el login normal.');
    }

    this.logger.log(`Creando usuario admin inicial: ${email}`);
    
    return this.usersService.create({
      email,
      password,
      firstName,
      lastName,
      isActive: true,
    });
  }
}
