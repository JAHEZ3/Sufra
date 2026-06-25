import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AppJwtService } from '../jwt/jwt.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: AppJwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader: string = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('رمز الوصول مفقود أو غير صالح.');
    }

    const token = authHeader.slice(7);
    const payload = await this.jwtService.verifyAccessToken(token);
    request.user = payload;
    return true;
  }
}
