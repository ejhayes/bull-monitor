import {Queue} from "bull";
import { createBullBoard } from "bull-board";
import { BullAdapter } from "bull-board/bullAdapter";
import { ConfigService } from "../../config/config.service";
import { LoggerService } from "../../logger";
import { IBullUi } from "../bull.interfaces";

/**
 * On the hacky side. This has the internal information for how
 * queues are stored in bull board. Since we are adding/removing
 * periodically we want to be able to modify these values in response
 * to incoming redis events.
 */
interface BullBoardLocals {
    bullBoardQueues: Map<string, BullAdapter>
}

export class BullBoardUi implements IBullUi {
    private readonly _ui: ReturnType<typeof createBullBoard>

    constructor(
        private readonly logger: LoggerService,
        private readonly configService: ConfigService
    ) {
        this._ui = createBullBoard([])
    }

    addQueue(queuePrefix: string, queueName: string, queue: Queue) {
        (this._ui.router.locals as BullBoardLocals)
            .bullBoardQueues
            .set(queueName, new BullAdapter(queue))  
    }

    removeQueue(queuePrefix: string, queueName: string) {
        (this._ui.router.locals as BullBoardLocals)
            .bullBoardQueues
            .delete(queueName)
    }

    get middleware() {
        return this._ui.router;
    }
}
