import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { createBullBoard } from "bull-board";
import { BullAdapter } from "bull-board/bullAdapter"
import { InjectLogger, LoggerService } from "../logger";
import { EVENT_TYPES, UI_TYPES } from "./bull.enums";
import { IQueueCreatedEvent, IQueueRemovedEvent } from "./bull.interfaces";
import Arena from 'bull-arena';
import Bull from 'bull';
import { ConfigService } from "../config/config.service";

@Injectable()
export class BullDashboardService {
    private readonly _dashboard: ReturnType<typeof createBullBoard> | ReturnType<typeof Arena>
//    private readonly _bullBoard = createBullBoard([]);
    constructor(
        @InjectLogger(BullDashboardService)
        private readonly logger: LoggerService,
        private readonly configService: ConfigService
    ) {
        switch(configService.config.UI) {
            case UI_TYPES.BULL_BOARD:
                this._dashboard = createBullBoard([])
                break;
            case UI_TYPES.ARENA:
                // TODO: fix this implementation
                this._dashboard = Arena({Bull,queues: [
                    {
                        hostId: '',
                        name: '',
                        redis: {
                            host: configService.config.REDIS_HOST,
                            port: configService.config.REDIS_PORT
                        },
                        type: 'bull'
                    }
                ]});
                // TODO: need to prevent this error https://github.com/bee-queue/arena/blob/master/src/server/queue/index.js#L28
                // @ts-ignore
                this._dashboard.locals.Queues._config.queues = [];
                break;
            default:
                throw new Error(`Unknown UI type: ${configService.config.UI}`);
        }
    }

    @OnEvent(EVENT_TYPES.QUEUE_CREATED)
    private addQueueToDashboard(event: IQueueCreatedEvent) {
        this.logger.log(`Adding queue to dashboard: ${event.queueName}`)
        
        switch(this.configService.config.UI) {
            case UI_TYPES.BULL_BOARD:
                (this._dashboard as ReturnType<typeof createBullBoard>).router.locals.bullBoardQueues.set(event.queueName, new BullAdapter(event.queue))
                break;
            case UI_TYPES.ARENA:
                // TODO: fix this implementation
                // @ts-ignore
                this._dashboard.locals.Queues._config.queues.push({
                    hostId: event.queuePrefix,
                    name: event.queueName,
                    redis: {
                        host: this.configService.config.REDIS_HOST,
                        port: this.configService.config.REDIS_PORT
                    },
                    type: 'bull'
                })
                break;
            default:
                throw new Error(`Unknown UI type: ${this.configService.config.UI}`);
        }
        
    }

    @OnEvent(EVENT_TYPES.QUEUE_REMOVED)
    private removeQueueFromDashboard(event: IQueueRemovedEvent) {
        this.logger.log(`Removing queue from dashboard: ${event.queueName}`)

        switch (this.configService.config.UI) {
            case UI_TYPES.BULL_BOARD:
                (this._dashboard as ReturnType<typeof createBullBoard>).router.locals.bullBoardQueues.delete(event.queueName);
                break;
            case UI_TYPES.ARENA:
            // TODO: fix this implementation
            // @ts-ignore    
            this._dashboard.locals.Queues._config.queues.splice(this._dashboard.locals.Queues._config.queues.findIndex(e => e.queueName == event.queueName),1)
                break;
            default:
                throw new Error(`Unknown UI type: ${this.configService.config.UI}`);
        }
        
    }

    get middleware() {
        switch (this.configService.config.UI) {
            case UI_TYPES.BULL_BOARD:
                return (this._dashboard as ReturnType<typeof createBullBoard>).router;
            case UI_TYPES.ARENA:
                // (this._dashboard as ReturnType<typeof Arena>)
                return (this._dashboard as ReturnType<typeof Arena>);
                break;
            default:
                throw new Error(`Unknown UI type: ${this.configService.config.UI}`);
        }
    }
}