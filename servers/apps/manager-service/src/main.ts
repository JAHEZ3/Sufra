import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ValidationPipe } from '@nestjs/common';
import { ManagerServiceModule } from './manager-service.module';
import { HttpExceptionFilter } from './filters/http-exception.filter';

process.on('uncaughtException', (err) => {
  console.error('[خطأ فادح] استثناء غير متوقع:', err.message, '\n', err.stack);
});
process.on('unhandledRejection', (reason) => {
  console.error('[خطأ فادح] وعد مرفوض غير معالج:', reason);
});

async function bootstrap() {
  const app = await NestFactory.create(ManagerServiceModule);

  // Browsers reject `Access-Control-Allow-Origin: *` together with credentials,
  // so we reflect the request origin when allowed. `CORS_ORIGINS=*` (or unset)
  // lets every origin through; a comma-separated list restricts to those.
  const allowList = (process.env.CORS_ORIGINS || '*')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const allowAny = allowList.includes('*');

  app.enableCors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // curl, server-to-server
      if (allowAny || allowList.includes(origin)) return cb(null, true);
      return cb(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type,Authorization',
  });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.NATS,
    options: { servers: [process.env.NATS_URL || 'nats://localhost:4222'] },
  });

  app.setGlobalPrefix('api/manager');
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.startAllMicroservices();
  await app.listen(3006);
  console.log('Manager Service is running on http://localhost:3006/api/manager');
}
bootstrap();
