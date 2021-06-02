import { Queue } from 'bullmq';
import { createBullBoard } from 'bull-board';
import { BullMQAdapter } from 'bull-board/bullMQAdapter';
import { ConfigService } from '../../config/config.service';
import { LoggerService } from '../../logger';
import { IBullUi } from '../bull.interfaces';

/**
 * On the hacky side. This has the internal information for how
 * queues are stored in bull board. Since we are adding/removing
 * periodically we want to be able to modify these values in response
 * to incoming redis events. There are currently existing methods
 * setQueues and replaceQueues but they seem a bit heavy handed
 */
interface BullBoardLocals {
  bullBoardQueues: Map<string, BullMQAdapter>;
}

export class BullBoardUi implements IBullUi {
  private readonly _ui: ReturnType<typeof createBullBoard>;

  constructor(
    private readonly logger: LoggerService,
    private readonly configService: ConfigService,
  ) {
    this._ui = createBullBoard([]);
  }

  addQueue(queuePrefix: string, queueName: string, queue: Queue) {
    const queueKey = `${queuePrefix}:${queueName}`;
    (this._ui.router.locals as BullBoardLocals).bullBoardQueues.set(
      queueKey,
      new BullMQAdapter(queue),
    );
  }

  removeQueue(queuePrefix: string, queueName: string) {
    const queueKey = `${queuePrefix}:${queueName}`;
    (this._ui.router.locals as BullBoardLocals).bullBoardQueues.delete(
      queueKey,
    );
  }

  get middleware() {
    return this._ui.router;
  }
}
