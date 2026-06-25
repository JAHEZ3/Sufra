import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    // HTTP context فقط — NATS/RPC تنتشر بشكل مستقل
    if (host.getType() !== 'http') return;

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    if (!(exception instanceof HttpException)) {
      this.logger.error(
        `خطأ غير متوقع: ${(exception as Error)?.message ?? exception}`,
        (exception as Error)?.stack,
      );
    }

    let message = 'حدث خطأ في الخادم. يرجى المحاولة مجدداً.';
    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      const raw =
        typeof res === 'object' && res !== null && (res as any).message
          ? (res as any).message
          : exception.message;
      message = Array.isArray(raw) ? raw[0] : raw;
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      data: null,
    });
  }
}

