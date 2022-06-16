import { ConfigModule } from '@app/config/config.module';
import { ConfigService } from '@app/config/config.service';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { RedisModule } from 'nestjs-redis';
import { BullDashboardMiddleware } from './bull-dashboard.middleware';
import { BullMetricsService } from './bull-metrics.service';
import { BullQueuesService } from './bull-queues.service';
import { BullUiService } from './bull-ui.service';
import { REDIS_CLIENTS } from './bull.enums';
import { BullMQMetricsFactory } from './bullmq-metrics.factory';

@Module({
  imports: [
    ConfigModule,
    RedisModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return [REDIS_CLIENTS.SUBSCRIBE, REDIS_CLIENTS.PUBLISH].map(
          (client) => {
            return {
              name: client,
              host: configService.config.REDIS_HOST,
              port: configService.config.REDIS_PORT,
              enableReadyCheck: true,
              reconnectOnError: () => true,
            };
          },
        );
      },
    }),
  ],
  providers: [
    BullQueuesService,
    BullMetricsService,
    BullUiService,
    BullMQMetricsFactory,
  ],
})
export class BullModule implements NestModule {
  configure(consumer: MiddlewareConsumer): MiddlewareConsumer | void {
    consumer.apply(BullDashboardMiddleware).forRoutes('queues');
  }
}
