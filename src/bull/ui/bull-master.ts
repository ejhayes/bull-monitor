import bullMaster from 'bull-master';
import { Queue } from 'bullmq';
import { ConfigService } from '../../config/config.service';
import { LoggerService } from '../../logger';
import { IBullUi } from '../bull.interfaces';

export class BullMasterUi implements IBullUi {
  private readonly _ui: any;

  constructor(
    private readonly logger: LoggerService,
    private readonly configService: ConfigService,
  ) {
    this._ui = bullMaster({
      queues: [],
    });
  }

  addQueue(queuePrefix: string, queueName: string, queue: Queue) {
    const current: Queue[] = this._ui.getQueues();
    current.push(queue);
    this._ui.setQueues(current);
  }

  removeQueue(queuePrefix: string, queueName: string) {
    const current: Queue[] = this._ui.getQueues();

    this._ui.setQueues(
      current.filter(
        (q) => !(q.opts.prefix === queuePrefix && q.name === queueName),
      ),
    );
  }

  get middleware() {
    return this._ui;
  }
}
