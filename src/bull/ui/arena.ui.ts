import { ConfigService } from '@app/config/config.service';
import { LoggerService } from '@app/logger';
import Bull from 'bull';
import Arena from 'bull-arena';
import { IBullUi } from '../bull.interfaces';

type BullArenaQueue = Parameters<typeof Arena>[0]['queues'][0];

/**
 * On the hacky side. This has the internal information for how
 * queues are stored in bull board. Since we are adding/removing
 * periodically we want to be able to modify these values in response
 * to incoming redis events.
 */
interface BullArenaLocals {
  Queues: {
    _config: {
      queues: BullArenaQueue[];
    };
  };
}

enum QUEUE_TYPES {
  BULL = 'bull',
}

export class BullArenaUi implements IBullUi {
  private readonly _ui: ReturnType<typeof Arena>;

  constructor(
    private readonly logger: LoggerService,
    private readonly configService: ConfigService,
  ) {
    this._ui = Arena(
      {
        Bull,
        queues: [
          {
            hostId: '',
            name: '',
            redis: {
              host: '',
              port: 0,
            },
            type: QUEUE_TYPES.BULL,
          },
        ],
      },
      {
        disableListen: true,
      },
    );

    // NOTE: we need to initialize with SOMETHING or else an error gets thrown
    // see https://github.com/bee-queue/arena/blob/master/src/server/queue/index.js#L28
    ((this._ui as any).locals as BullArenaLocals).Queues._config.queues = [];
  }

  addQueue(queuePrefix: string, queueName: string, queue: Bull.Queue) {
    ((this._ui as any).locals as BullArenaLocals).Queues._config.queues.push({
      hostId: queuePrefix,
      name: queueName,
      prefix: queuePrefix,
      redis: {
        host: this.configService.config.REDIS_HOST,
        port: this.configService.config.REDIS_PORT,
      },
      type: QUEUE_TYPES.BULL,
    });
  }

  removeQueue(queuePrefix: string, queueName: string) {
    ((this._ui as any).locals as BullArenaLocals).Queues._config.queues.splice(
      (
        (this._ui as any).locals as BullArenaLocals
      ).Queues._config.queues.findIndex(
        (e) => e.name == queueName && e.hostId == queuePrefix,
      ),
      1,
    );
  }

  get middleware() {
    return this._ui;
  }
}
