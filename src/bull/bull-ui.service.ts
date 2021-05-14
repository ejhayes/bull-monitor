import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { createBullBoard } from "bull-board";
import { BullAdapter } from "bull-board/bullAdapter"
import { InjectLogger, LoggerService } from "../logger";
import { EVENT_TYPES, UI_TYPES } from "./bull.enums";
import { IQueueCreatedEvent, IQueueRemovedEvent, IBullUi } from "./bull.interfaces";
import Arena from 'bull-arena';
import Bull from 'bull';
import { ConfigService } from "../config/config.service";
import { BullBoardUi } from "./ui/bull-board.ui";
import { BullArenaUi } from "./ui/arena.ui";

@Injectable()
export class BullUiService {
    private readonly _ui: IBullUi

    constructor(
        @InjectLogger(BullUiService)
        private readonly logger: LoggerService,
        private readonly configService: ConfigService
    ) {
        switch(configService.config.UI) {
            case UI_TYPES.BULL_BOARD:
                this._ui = new BullBoardUi(logger, configService);
                break;
            case UI_TYPES.ARENA:
                this._ui = new BullArenaUi(logger, configService);
                break;
            default:
                throw new Error(`Unknown UI type: ${configService.config.UI}`);
        }
    }

    @OnEvent(EVENT_TYPES.QUEUE_CREATED)
    private addQueueToDashboard(event: IQueueCreatedEvent) {
        this.logger.log(`Adding queue to dashboard: ${event.queueName}`)
        this._ui.addQueue(event.queuePrefix, event.queueName, event.queue);
    }

    @OnEvent(EVENT_TYPES.QUEUE_REMOVED)
    private removeQueueFromDashboard(event: IQueueRemovedEvent) {
        this.logger.log(`Removing queue from dashboard: ${event.queueName}`);
        this._ui.removeQueue(event.queuePrefix, event.queueName);
    }

    get middleware() {
        return this._ui.middleware;
    }
}