import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcryptjs';
import { User } from '@prisma/client';

export interface JwtPayload {
  sub: number;
  email: string;
  name: string;
  role: string;
}

export interface AuthResponse {
  user: {
    id: number;
    email: string;
    name: string;
    role: string;
    active: boolean;
  };
  access_token?: string;
  message?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    const { email, password, name, role } = registerDto;

    // No permitir registro de administradores
    if (role === 'ADMIN') {
      throw new BadRequestException('No se permite el registro directo de administradores');
    }

    // Verificar si el usuario ya existe
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('El usuario ya existe con este email');
    }

    // Hashear la contraseña
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    try {
      // Crear el usuario (inactivo por defecto)
      const user = await this.prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          role,
          active: false, // Los usuarios se registran inactivos
        },
      });

      // No generar JWT para usuarios inactivos - solo confirmar registro
      return {
        message: 'Usuario registrado exitosamente. Su cuenta está pendiente de activación. Se le notificará por correo electrónico cuando esté activa.',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          active: user.active,
        },
      };
    } catch (error) {
      console.error('Error creating user:', error);
      throw new BadRequestException('Error al crear el usuario');
    }
  }

  async checkEmailAvailability(email: string): Promise<{ available: boolean }> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Este email ya está registrado');
    }

    return { available: true };
  }

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const { email, password } = loginDto;

    // Buscar usuario por email
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Email o contraseña incorrectos');
    }

    // Verificar si el usuario está activo
    if (!user.active) {
      throw new UnauthorizedException('Usuario desactivado');
    }

    // Verificar contraseña
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Email o contraseña incorrectos');
    }

    // Generar JWT
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };

    const access_token = this.jwtService.sign(payload);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        active: user.active,
      },
      access_token,
    };
  }

  async validateUser(payload: JwtPayload): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.active) {
      return null;
    }

    return user;
  }

  async getUserProfile(userId: number): Promise<Omit<User, 'password'>> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    return user;
  }
}