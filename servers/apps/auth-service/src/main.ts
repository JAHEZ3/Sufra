import { NestFactory } from "@nestjs/core";
import { MicroserviceOptions, Transport } from "@nestjs/microservices";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthServiceModule } from "./auth-service.module";
import { HttpExceptionFilter } from "./filters/http-exception.filter";
import { ResponseInterceptor } from "./interceptors/response.interceptor";

process.on("uncaughtException", (err) => {
  console.error("[خطأ فادح] استثناء غير متوقع:", err.message, "\n", err.stack);
});
process.on("unhandledRejection", (reason) => {
  console.error("[خطأ فادح] وعد مرفوض غير معالج:", reason);
});

async function bootstrap() {
  const app = await NestFactory.create(AuthServiceModule);
  const config = app.get(ConfigService);

  const rawOrigins = config.get<string>("CORS_ORIGINS", "");
  const allowedOrigins = rawOrigins ? rawOrigins.split(",").map((o) => o.trim()) : [];
  const isProd = config.get<string>("NODE_ENV") === "production";
  const LOCALHOST_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
  // Private RFC-1918 LAN ranges — 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16.
  // Allowing these in non-prod lets a phone/dashboard on the same Wi-Fi hit
  // the dev server without us having to enumerate every device IP in .env.
  const LAN_RE =
    /^https?:\/\/(10(\.\d{1,3}){3}|172\.(1[6-9]|2\d|3[0-1])(\.\d{1,3}){2}|192\.168(\.\d{1,3}){2})(:\d+)?$/;

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.length === 0) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      if (!isProd && LOCALHOST_RE.test(origin)) return callback(null, true);
      if (!isProd && LAN_RE.test(origin)) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    allowedHeaders: "Content-Type,Authorization",
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.NATS,
    options: {
      servers: [config.get<string>("NATS_URL", "nats://localhost:4222")],
      // Queue group → only one instance of this service handles each event.
      queue: "auth-service",
    },
  });

  app.setGlobalPrefix("api/auth");
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  await app.startAllMicroservices();
  await app.listen(config.get<number>("AUTH_PORT", 3004));
  console.log(`Auth Service running on port ${config.get("AUTH_PORT", 3004)}`);
}
bootstrap();
