import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Queue } from 'bullmq';
import { ConfigService } from '../../config/config.service';
import { LoggerService } from '../../logger';
import { IBullUi } from '../bull.interfaces';

export class BullBoardUi implements IBullUi {
  private readonly _ui: ExpressAdapter; //ReturnType<typeof createBullBoard>;
  private readonly _board: ReturnType<typeof createBullBoard>;

  constructor(
    private readonly logger: LoggerService,
    private readonly configService: ConfigService,
  ) {
    this._ui = new ExpressAdapter();
    this._ui.setBasePath('/queues');

    this._board = createBullBoard({ queues: [], serverAdapter: this._ui });
  }

  addQueue(queuePrefix: string, queueName: string, queue: Queue) {
    this._board.addQueue(new BullMQAdapter(queue));
  }

  removeQueue(queuePrefix: string, queueName: string) {
    this._board.removeQueue(queueName);
  }

  get middleware() {
    return this._ui.getRouter();
  }
}
