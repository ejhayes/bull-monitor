import { UI_TYPES } from '@app/bull/bull.enums';
import { LOG_LEVELS } from '@app/logger/common';
import { RedisClientOptions, RedisModuleOptions } from '@liaoliaots/nestjs-redis';
import { Injectable } from '@nestjs/common';
import { ConnectionOptions } from 'bullmq';
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
     * Redis database number
     */
    REDIS_DB: num({ default: 0 }),
    /**
     * Redis host to fetch queues from
     */
    REDIS_HOST: str({default: undefined, requiredWhen: (cleanedEnv) => !cleanedEnv['REDIS_URL']}),
    /**
     * Redis port to fetch queues from
     */
    REDIS_PORT: port({default: undefined, requiredWhen: (cleanedEnv) => !cleanedEnv['REDIS_URL']}),
    /**
     * Redis password (if needed)
     */
    REDIS_PASSWORD: str({ default: '' }),
    /**
     * Redis URL (for advanced use cases)
     */
    REDIS_URL: str({default: undefined, requiredWhen: (cleanedEnv) => !cleanedEnv['REDIS_HOST'] || !cleanedEnv['REDIS_PORT']}),
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
      choices: [UI_TYPES.BULL_BOARD, UI_TYPES.QUEUEDASH],
    }),
    /**
     * Version
     */
    VERSION: str(),
  });

  get config() {
    return this._config;
  }

  get redisConfig(): RedisClientOptions {
    // If REDIS_URL is specified, use that
    if (this.config.REDIS_URL ) {
      return {
        url: this.config.REDIS_URL,
        enableReadyCheck: true,
        reconnectOnError: () => true,
      };
    }

    return {
      host: this.config.REDIS_HOST,
      password: this.config.REDIS_PASSWORD,
      port: this.config.REDIS_PORT,
      db: this.config.REDIS_DB,
      enableReadyCheck: true,
      reconnectOnError: () => true,
    };
  }

  get bullRedisConfig(): ConnectionOptions {
    // If REDIS_URL is specified, use that
    if (this.config.REDIS_URL ) {
      return {
        url: this.config.REDIS_URL,
      };
    }

    return {
      host: this.config.REDIS_HOST,
      password: this.config.REDIS_PASSWORD,
      port: this.config.REDIS_PORT,
      db: this.config.REDIS_DB,
    };
  }
}
