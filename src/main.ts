import 'source-map-support/register';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from './config/config.service';
import { LoggerService } from './logger';
import { OpenAPIModule } from './openapi/openapi.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService: ConfigService = app.get(ConfigService);
  const loggerService: LoggerService = await app.resolve(LoggerService);
  loggerService.setContext(bootstrap.name);
  app.useLogger(loggerService);

  OpenAPIModule.setup('docs', app);

  loggerService.log(`Listening on HTTP port ${configService.config.PORT}`);
  await app.listen(configService.config.PORT);
}
bootstrap();
