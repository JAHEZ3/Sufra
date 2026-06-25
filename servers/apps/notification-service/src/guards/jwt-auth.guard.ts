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
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const header: string = req.headers['authorization'] ?? '';
    if (!header.startsWith('Bearer ')) {
      throw new UnauthorizedException('رمز الوصول مفقود أو غير صالح.');
    }
    const token = header.slice(7);
    const secret = this.config.get<string>('JWT_ACCESS_SECRET');
    if (!secret) throw new UnauthorizedException('خطأ في إعداد الخادم.');
    try {
      req.user = this.jwt.verify(token, { secret });
      return true;
    } catch {
      throw new UnauthorizedException('رمز الوصول غير صالح أو منتهي الصلاحية.');
    }
  }
}
