import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader: string = request.headers['authorization'];

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('رمز الوصول مفقود أو غير صالح.');
    }

    const secret = this.configService.get<string>('JWT_ACCESS_SECRET');
    if (!secret) throw new UnauthorizedException('خطأ في إعداد الخادم.');

    const token = authHeader.slice(7);
    try {
      const payload = this.jwtService.verify(token, { secret });
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('رمز الوصول غير صالح أو منتهي الصلاحية.');
    }
  }
}
