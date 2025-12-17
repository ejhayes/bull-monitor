import { createQueueDashExpressMiddleware, Context } from "@queuedash/api";
import { Queue } from 'bullmq';
import { ConfigService } from '../../config/config.service';
import { LoggerService } from '../../logger';
import { IBullUi } from '../bull.interfaces';

export class QueuedashUi implements IBullUi {
  private readonly _ui: any;
  private readonly _ctx: Context = { queues: []};

  constructor(
    private readonly logger: LoggerService,
    private readonly configService: ConfigService,
  ) {
    this._ui = createQueueDashExpressMiddleware({ ctx: this._ctx });
  }

  addQueue(queuePrefix: string, queueName: string, queue: Queue) {
    const index = this._ctx.queues.findIndex(item => item.type === 'bullmq' && item.queue.qualifiedName === queue.qualifiedName);

    if (index === -1) {
      this._ctx.queues.push({
        type: 'bullmq',
        queue,
        displayName: queueName
      });
    }
  }

  removeQueue(queuePrefix: string, queueName: string) {
    const index = this._ctx.queues.findIndex(item => item.type === 'bullmq' && item.queue.qualifiedName === `${queuePrefix}:${queueName}`);

    if (index >= 0) {
      this._ctx.queues.splice(index, 1);
    }
  }

  get middleware() {
    return this._ui;
  }
}
