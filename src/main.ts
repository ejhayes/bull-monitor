import 'source-map-support/register';

import * as Sentry from '@sentry/node';
import '@sentry/tracing';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  release: process.env.VERSION,
});

// eslint-disable-next-line import/order
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from './config/config.service';
import { LoggerService } from './logger';
import { OpenAPIModule } from './openapi/openapi.module';

async function bootstrap() {
  const logger = new LoggerService();
  logger.setContext(bootstrap.name);
  const app = await NestFactory.create(AppModule, { logger });
  const configService: ConfigService = app.get(ConfigService);

  OpenAPIModule.setup('docs', app);

  logger.log(`Listening on HTTP port ${configService.config.PORT}`);
  await app.listen(configService.config.PORT);
}

// uncaught redis or mutex issues should result in the process being restarted
process.on('uncaughtException', (err) => {
  console.error(err.name);
  console.error(err.stack);
  process.exit(1);
});

bootstrap();
