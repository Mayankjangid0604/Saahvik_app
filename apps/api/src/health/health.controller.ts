import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Unauthenticated health check for external uptime monitors (e.g.
 * BetterStack) — excluded from the global 'api/v1' prefix in main.ts so it
 * is reachable at the bare path an uptime monitor typically expects, in
 * addition to the versioned path.
 *
 * Actually verifies database connectivity rather than just confirming the
 * Node process is alive, since "the process didn't crash" is not the same
 * guarantee as "the API can serve requests."
 */
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        database: 'ok',
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      this.logger.error('Health check failed: database unreachable', err);
      // A real 503 (not a 200 with an error body) so an uptime monitor's
      // status-code check actually fires.
      throw new ServiceUnavailableException('Database unreachable');
    }
  }
}
