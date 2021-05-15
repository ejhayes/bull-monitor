import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { RedisModule } from "nestjs-redis";
import { ConfigService } from "../config/config.service";
import { ConfigModule } from "../config/config.module";
import { BullQueuesService } from "./bull-queues.service";
import { BullDashboardMiddleware } from "./bull-dashboard.middleware";
import { BullMetricsService } from "./bull-metrics.service";
import { BullUiService } from "./bull-ui.service";
import { REDIS_CLIENTS } from "./bull.enums";

@Module({
    imports: [
        ConfigModule,
        RedisModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => {
                return [REDIS_CLIENTS.SUBSCRIBE, REDIS_CLIENTS.PUBLISH].map((client) => {
                    return {
                        name: client,
                        host: configService.config.REDIS_HOST,
                        port: configService.config.REDIS_PORT,
                        enableReadyCheck: true
                    }
                })
            }
        }),
    ],
    providers: [BullQueuesService, BullMetricsService, BullUiService]
})
export class BullModule implements NestModule {
    configure(consumer: MiddlewareConsumer): MiddlewareConsumer | void {
        consumer
            .apply(BullDashboardMiddleware)
            .forRoutes("queues")
    }
}
