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
    const auth: string = req.headers['authorization'] ?? '';
    if (!auth.startsWith('Bearer ')) throw new UnauthorizedException('مطلوب رمز المصادقة');

    const token = auth.slice(7);
    try {
      req.user = this.jwt.verify(token, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      });
      return true;
    } catch {
      throw new UnauthorizedException('رمز المصادقة غير صالح أو منتهي الصلاحية');
    }
  }
}
