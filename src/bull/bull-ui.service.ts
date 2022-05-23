import { Injectable } from '@nestjs/common';
import { TypedEmitter } from 'tiny-typed-emitter2';
import { ConfigService } from '../config/config.service';
import { InjectLogger, LoggerService } from '../logger';
import { EVENT_TYPES, UI_TYPES } from './bull.enums';
import { BullQueuesServiceEvents, IBullUi } from './bull.interfaces';
import { BullArenaUi } from './ui/arena.ui';
import { BullBoardUi } from './ui/bull-board.ui';

@Injectable()
export class BullUiService {
  private readonly _ui: IBullUi;

  constructor(
    @InjectLogger(BullUiService)
    private readonly logger: LoggerService,
    private readonly configService: ConfigService,
    events: TypedEmitter<BullQueuesServiceEvents>,
  ) {
    switch (configService.config.UI) {
      case UI_TYPES.BULL_BOARD:
        this._ui = new BullBoardUi(logger, configService);
        break;
      case UI_TYPES.ARENA:
        this._ui = new BullArenaUi(logger, configService);
        break;
      default:
        throw new Error(`Unknown UI type: ${configService.config.UI}`);
    }

    events.on(EVENT_TYPES.QUEUE_CREATED, (event) => {
      this.logger.log(`Adding queue to dashboard: ${event.queueName}`);
      this._ui.addQueue(event.queuePrefix, event.queueName, event.queue);
    });

    events.on(EVENT_TYPES.QUEUE_REMOVED, (event) => {
      this.logger.log(`Removing queue from dashboard: ${event.queueName}`);
      this._ui.removeQueue(event.queuePrefix, event.queueName);
    });
  }

  get middleware() {
    return this._ui.middleware;
  }
}
