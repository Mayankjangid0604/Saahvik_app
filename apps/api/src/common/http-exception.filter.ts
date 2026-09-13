import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { wrapError } from './response';
import { Sentry } from './sentry';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();

      if (typeof body === 'string') {
        code = body;
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const b = body as { message?: string | string[]; error?: string };
        if (Array.isArray(b.message)) {
          code = 'VALIDATION_ERROR';
          message = b.message.join(', ');
        } else {
          code = b.message ?? b.error ?? 'ERROR';
          message = b.message ?? b.error ?? 'An error occurred';
        }
      }
    } else {
      // Unexpected (non-HttpException) errors are logged in full server-side
      // so they remain debuggable, while the client only ever sees the
      // generic envelope above.
      this.logger.error(
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    // Report genuine server-side failures (5xx) to Sentry — a no-op when
    // SENTRY_DSN isn't configured. Never affects the client response below;
    // this only ever adds telemetry, it doesn't change status/code/message.
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      Sentry.captureException(exception);
    }

    response.status(status).json(wrapError(code, message, 'v1'));
  }
}
