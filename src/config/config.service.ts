import { UI_TYPES } from '@app/bull/bull.enums';
import { LOG_LEVELS } from '@app/logger/common';
import { Injectable } from '@nestjs/common';
import { bool, cleanEnv, num, port, str } from 'envalid';

@Injectable()
export class ConfigService {
  private readonly _config = cleanEnv(process.env, {
    /**
     * Collect NodeJS metrics (default: false)
     */
    COLLECT_NODEJS_METRICS: bool({ default: false }),
    /**
     * Collect NodeJS metrics ever N milliseconds (default 60 seconds)
     */
    COLLECT_NODEJS_METRICS_INTERVAL_MS: num({ default: 60000 }),
    /**
     * Disable logging (only permitted when NODE_ENV is 'test')
     */
    DISABLE_LOGGING: bool({ default: false }),
    /**
     * Automatically update redis configuration (false requires you
     * to manually set keyspace notifications)
     */
    REDIS_CONFIGURE_KEYSPACE_NOTIFICATIONS: bool({ default: true }),
    /**
     * Redis host to fetch queues from
     */
    REDIS_HOST: str(),
    /**
     * Redis port to fetch queues from
     */
    REDIS_PORT: port(),
    /**
     * Redis password (if needed)
     */
    REDIS_PASSWORD: str({ default: '' }),
    /**
     * Comma separate list of bull queue prefixes to
     * monitor (default: bull)
     */
    BULL_WATCH_QUEUE_PREFIXES: str({ default: 'bull' }),
    /**
     * Fetch queue metrics ever N milliseconds (default 60 seconds)
     */
    BULL_COLLECT_QUEUE_METRICS_INTERVAL_MS: num({ default: 60000 }),
    /**
     * Default log label to use
     */
    LOG_LABEL: str({ default: 'bull-monitor' }),
    /**
     * Logging level to use
     */
    LOG_LEVEL: str({
      choices: [
        LOG_LEVELS.DEBUG,
        LOG_LEVELS.ERROR,
        LOG_LEVELS.INFO,
        LOG_LEVELS.WARN,
      ],
      default: LOG_LEVELS.INFO,
    }),
    /**
     * NodeJS environment name
     */
    NODE_ENV: str({ default: 'production' }),
    /**
     * Default port to use
     */
    PORT: port({ default: 3000 }),
    /**
     * Delay time before restarting process
     */
    RESTART_DELAY_MS: num({ default: 1000 }),
    /**
     * Sentry DSN to use (leave blank to disable)
     */
    SENTRY_DSN: str({ default: '' }),
    /**
     * UI to use (default: bull-board)
     */
    UI: str({
      default: UI_TYPES.BULL_BOARD,
      choices: [UI_TYPES.BULL_BOARD, UI_TYPES.ARENA],
    }),
    /**
     * Version
     */
    VERSION: str(),
  });

  get config() {
    return this._config;
  }
}
