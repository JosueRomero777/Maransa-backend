import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Public } from './decorators/public.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GetUser } from './decorators/get-user.decorator';
import { User } from '@prisma/client';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Public()
  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Public()
  @Post('check-email')
  async checkEmail(@Body() { email }: { email: string }) {
    return this.authService.checkEmailAvailability(email);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@GetUser() user: User) {
    return this.authService.getUserProfile(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('validate')
  async validateToken(@GetUser() user: User) {
    return {
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        active: user.active,
      },
    };
  }
}