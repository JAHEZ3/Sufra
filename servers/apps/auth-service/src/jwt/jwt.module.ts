import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RefreshToken } from '../entities/refresh-token.entity';
import { AppJwtService } from './jwt.service';

@Global()
@Module({
  imports: [JwtModule.register({}), TypeOrmModule.forFeature([RefreshToken])],
  providers: [AppJwtService],
  exports: [AppJwtService],
})
export class AppJwtModule {}
