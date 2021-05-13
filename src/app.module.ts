import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigModule } from './config/config.module';
import { ConfigService } from './config/config.service';
import { HealthModule } from './health/health.module';
import { LoggerModule } from './logger';
import { LOG_LEVELS } from './logger/common';
import { MetricsModule } from './metrics';
import { VersionModule } from './version/version.module';
import { BullModule } from './bull/bull.module';

@Module({
  imports: [
    BullModule,
    EventEmitterModule.forRoot(),
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        return {
          env: configService.config.NODE_ENV,
          label: configService.config.LOG_LABEL,
          level: configService.config.LOG_LEVEL as LOG_LEVELS,
        };
      },
    }),
    ConfigModule,
    HealthModule,
    MetricsModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        return {
          collectDefaultMetrics: configService.config.COLLECT_NODEJS_METRICS,
          collectMetricsEveryNMilliseconds:
            configService.config.COLLECT_NODEJS_METRICS_INTERVAL_MS,
        };
      },
    }),
    VersionModule,
  ],
})
export class AppModule {}


// TODO: bull arena/dashboard view
// TODO: sentry errors?
