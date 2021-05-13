import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { RedisModule } from "nestjs-redis";
import { ConfigService } from "../config/config.service";
import { ConfigModule } from "../config/config.module";
import { BullQueuesService } from "./bull-queues.service";
import { BullDashboardMiddleware } from "./bull-dashboard.middleware";
import { BullMetricsService } from "./bull-metrics.service";
import { BullDashboardService } from "./bull-dashboard.service";

@Module({
    imports: [
        ConfigModule,
        RedisModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => {
                return {
                    host: configService.config.REDIS_HOST,
                    port: configService.config.REDIS_PORT,
                    enableReadyCheck: true
                }
            }
        }),
    ],
    providers: [BullQueuesService, BullMetricsService, BullDashboardService]
})
export class BullModule implements NestModule {
    configure(consumer: MiddlewareConsumer): MiddlewareConsumer | void {
        consumer
            .apply(BullDashboardMiddleware)
            .forRoutes("queues")
    }
}
