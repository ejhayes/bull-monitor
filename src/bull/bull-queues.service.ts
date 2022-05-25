import { ConfigService } from '@app/config/config.service';
import { InjectLogger, LoggerService } from '@app/logger';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Mutex } from 'async-mutex';
import { Queue, QueueScheduler } from 'bullmq';
import Redis from 'ioredis';
import { RedisService } from 'nestjs-redis';
import { TypedEmitter } from 'tiny-typed-emitter2';
import {
  EVENT_TYPES,
  REDIS_CLIENTS,
  REDIS_EVENT_TYPES,
  REDIS_KEYSPACE_EVENT_TYPES,
} from './bull.enums';
import {
  BullQueuesServiceEvents,
  QueueCreatedEvent,
  QueueRemovedEvent,
} from './bull.interfaces';

const BULL_QUEUE_REGEX = /(?<queuePrefix>^[^:]+):(?<queueName>[^:]+):/;
const BULL_KEYSPACE_REGEX = /(?<queuePrefix>[^:]+):(?<queueName>[^:]+):meta$/;
const parseBullQueue = (key: string) => {
  const MATCHER = key.match(/:meta$/) ? BULL_KEYSPACE_REGEX : BULL_QUEUE_REGEX;
  const match = key.match(MATCHER);
  return {
    queuePrefix: match.groups?.queuePrefix
      ? match.groups.queuePrefix
      : 'unknown',
    queueName: match.groups?.queueName ? match.groups.queueName : 'unknown',
  };
};

const REDIS_CONFIG_NOTIFY_KEYSPACE_EVENTS = 'notify-keyspace-events';

// Expected configuration flags
const REDIS_CONFIG_NOTIFY_KEYSPACE_EVENTS_FLAGS = 'A$K';

@Injectable()
export class BullQueuesService implements OnModuleInit, OnModuleDestroy {
  private _initialized = false;
  private readonly _queues: { [queueName: string]: Queue } = {};
  private readonly _schedulers: { [queueName: string]: QueueScheduler } = {};

  constructor(
    private readonly eventEmitter: TypedEmitter<BullQueuesServiceEvents>,
    @InjectLogger(BullQueuesService)
    private readonly logger: LoggerService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  private async processMessage(
    eventType: REDIS_KEYSPACE_EVENT_TYPES,
    queuePrefix: string,
    queueName: string,
  ) {
    const mutex = new Mutex();
    return await mutex.runExclusive(async () => {
      switch (eventType) {
        case REDIS_KEYSPACE_EVENT_TYPES.HSET:
          await this.addQueue(queuePrefix, queueName);
          break;
        case REDIS_KEYSPACE_EVENT_TYPES.DELETE:
          await this.removeQueue(queuePrefix, queueName);
          break;
        default:
          this.logger.debug(`Ignoring event '${eventType}'`);
      }
    });
  }

  getLoadedQueues(): string[] {
    return Object.keys(this._queues);
  }

  private generateQueueKey(queuePrefix: string, queueName: string): string {
    return `${queuePrefix}:::${queueName}`;
  }

  private splitQueueKey(queueKey: string): {
    queueName: string;
    queuePrefix: string;
  } {
    return queueKey.match(/^(?<queuePrefix>.+):::(?<queueName>.+)$/).groups as {
      queueName: string;
      queuePrefix: string;
    };
  }

  private addQueue(queuePrefix: string, queueName: string) {
    const client = this.redisService.getClient(REDIS_CLIENTS.PUBLISH);
    const queueKey = this.generateQueueKey(queuePrefix, queueName);
    this.logger.debug(`Attempting to add queue: ${queueKey}`);
    if (!(queueKey in this._queues)) {
      this.logger.log(`Adding queue: ${queueKey}`);
      this._queues[queueKey] = new Queue(queueName, {
        prefix: queuePrefix,
        connection: client,
      });
      this._queues[queueKey].on('error', (err) => {
        Error.captureStackTrace(err);
        this.logger.error(err.stack);
        this.removeQueue(queuePrefix, queueName);
      });
      /**
       * From: https://docs.bullmq.io/guide/connections
       *
       * Every class will consume at least one Redis connection, but it
       * is also possible to reuse connections in some situations. For example,
       * the Queue and Worker classes can accept an existing ioredis instance, and
       * by that reusing that connection, however QueueScheduler and QueueEvents
       * cannot do that because they require blocking connections to Redis, which
       * makes it impossible to reuse them.
       */
      this._schedulers[queueKey] = new QueueScheduler(queueName, {
        prefix: queuePrefix,
        connection: {
          host: this.configService.config.REDIS_HOST,
          port: this.configService.config.REDIS_PORT,
        },
      });
      this._schedulers[queueKey].on('error', (err) => {
        Error.captureStackTrace(err);
        this.logger.error(err.stack);
        this.removeQueue(queuePrefix, queueName);
      });
      this.eventEmitter.emit(
        EVENT_TYPES.QUEUE_CREATED,
        new QueueCreatedEvent(queuePrefix, this._queues[queueKey]),
      );
    }
  }

  private async removeQueue(queuePrefix: string, queueName: string) {
    const queueKey = this.generateQueueKey(queuePrefix, queueName);
    this.logger.debug(`Attempting to remove queue: ${queueKey}`);
    if (queueKey in this._queues) {
      this.logger.log(`Removing queue: ${queueKey}`);
      this.eventEmitter.emit(
        EVENT_TYPES.QUEUE_REMOVED,
        new QueueRemovedEvent(queuePrefix, queueName),
      );
      try {
        await this._queues[queueKey].close();
        await this._schedulers[queueKey].close();
      } catch (err) {
        // in the event of an error just ignore it and move on
        this.logger.error(err);
      }

      delete this._queues[queueKey];
      delete this._schedulers[queueKey];
    }
  }

  private async findAndPopulateQueues(match: string): Promise<string[]> {
    const client = await this.redisService.getClient(REDIS_CLIENTS.PUBLISH);
    const loadedQueues = new Set([]);
    return new Promise((resolve, reject) => {
      client
        .scanStream({ type: 'hash', match, count: 100 })
        .on('data', (keys: string[]) => {
          for (const key of keys) {
            const queueMatch = parseBullQueue(key);
            loadedQueues.add(
              this.generateQueueKey(
                queueMatch.queuePrefix,
                queueMatch.queueName,
              ),
            );
            this.addQueue(queueMatch.queuePrefix, queueMatch.queueName);
          }
        })
        .on('end', () => {
          resolve(Array.from(loadedQueues));
        })
        .on('error', (err) => {
          this.logger.error(`${err.name}: ${err.message}`);
          this.logger.error(`${err.stack}`);
          reject(err);
        });
    });
  }

  /**
   * Ensure that are are at least monitoring keyspace events
   *
   * @url https://redis.io/topics/notifications
   *
   * By default keyspace event notifications are disabled because while
   * not very sensible the feature uses some CPU power. Notifications are
   * enabled using the notify-keyspace-events of redis.conf or via the CONFIG SET.
   *
   * Setting the parameter to the empty string disables notifications. In order to
   * enable the feature a non-empty string is used, composed of multiple characters,
   * where every character has a special meaning according to the following table:
   *
   * K     Keyspace events, published with __keyspace@<db>__ prefix.
   * E     Keyevent events, published with __keyevent@<db>__ prefix.
   * g     Generic commands (non-type specific) like DEL, EXPIRE, RENAME, ...
   * $     String commands
   * l     List commands
   * s     Set commands
   * h     Hash commands
   * z     Sorted set commands
   * t     Stream commands
   * d     Module key type events
   * x     Expired events (events generated every time a key expires)
   * e     Evicted events (events generated when a key is evicted for maxmemory)
   * m     Key miss events (events generated when a key that doesn't exist is accessed)
   * A     Alias for "g$lshztxed", so that the "AKE" string means all the events except "m".
   */
  private async configureKeyspaceEventNotifications() {
    if (!this.configService.config.REDIS_CONFIGURE_KEYSPACE_NOTIFICATIONS) {
      this.logger.log('Skipping redis keyspace notification configuration.');
      return;
    }

    const client = await this.redisService.getClient(REDIS_CLIENTS.PUBLISH);
    const keyspaceConfig = (
      (await client.config('GET', REDIS_CONFIG_NOTIFY_KEYSPACE_EVENTS))[1] || ''
    )
      .split('')
      .sort()
      .join('');
    const expectedConfig = [
      ...new Set(keyspaceConfig + REDIS_CONFIG_NOTIFY_KEYSPACE_EVENTS_FLAGS),
    ]
      .sort()
      .join('');
    this.logger.log(
      `Redis config for ${REDIS_CONFIG_NOTIFY_KEYSPACE_EVENTS}: '${keyspaceConfig}'`,
    );

    if (keyspaceConfig !== expectedConfig) {
      this.logger.log(
        `Updating ${REDIS_CONFIG_NOTIFY_KEYSPACE_EVENTS} to '${expectedConfig}'`,
      );
      await client.config(
        'SET',
        REDIS_CONFIG_NOTIFY_KEYSPACE_EVENTS,
        expectedConfig,
      );
    }
  }

  async onModuleDestroy() {
    this.logger.log('Destroying....');
    await this.redisService.getClients().forEach(async (client) => {
      await client.quit();
    });

    this.eventEmitter.emit(EVENT_TYPES.QUEUE_SERVICE_CLOSED);
    this.eventEmitter.removeAllListeners();
  }

  private async initializeClient(client: Redis) {
    //if (this._initialized) return;

    this.logger.log(
      'Redis connection READY! Configuring watchers for bull queues.',
    );

    await this.configureKeyspaceEventNotifications();

    const previouslyLoadedQueues = this.getLoadedQueues();
    let newlyLoadedQueues: Array<any> = [];
    this.logger.debug(
      `Queues currently monitored: ${
        previouslyLoadedQueues.length > 0
          ? previouslyLoadedQueues.join(', ')
          : '<none>'
      }`,
    );
    const queuePrefixes =
      this.configService.config.BULL_WATCH_QUEUE_PREFIXES.split(',').map(
        (item) => item.trim(),
      );
    // loop through each queue prefix and add anything
    // we find
    for (const queuePrefix of queuePrefixes) {
      this.logger.log(`Loading queues from queuePrefix: '${queuePrefix}'`);

      newlyLoadedQueues = (
        await Promise.all([
          // this.findAndPopulateQueues(`${queuePrefix}:*:stalled-check`),
          //this.findAndPopulateQueues(`${queuePrefix}:*:id`),
          this.findAndPopulateQueues(`${queuePrefix}:*:meta`),
        ])
      ).flat();

      // subscribe to keyspace events
      client.psubscribe(
        `__keyspace@0__:${queuePrefix}:*:meta`,
        (err, count) => {
          this.logger.log(`Subscribed to keyspace events for ${queuePrefix}`);
        },
      );
    }

    // logic to handle incoming events
    client.on(
      REDIS_EVENT_TYPES.PMESSAGE,
      async (pattern: string, channel: string, message: string) => {
        const queueMatch = parseBullQueue(channel);
        await this.processMessage(
          message as REDIS_KEYSPACE_EVENT_TYPES,
          queueMatch.queuePrefix,
          queueMatch.queueName,
        );
      },
    );

    /**
     * In the event that we are reloading this configuration (perhaps after a loss of
     * connection) we'll want to ensure that we prune any queues that may have been removed
     * during the outage.
     */
    const queuesToPrune = previouslyLoadedQueues.filter(
      (x) => !newlyLoadedQueues.includes(x),
    );
    this.logger.log(
      `Pruning unused queues: ${
        queuesToPrune.length > 0 ? queuesToPrune.join(', ') : '<none>'
      }`,
    );
    for (const queueToPrune of queuesToPrune) {
      const queueDetails = this.splitQueueKey(queueToPrune);
      await this.removeQueue(queueDetails.queuePrefix, queueDetails.queueName);
    }

    this._initialized = true;
    this.eventEmitter.emit(EVENT_TYPES.QUEUE_SERVICE_READY);
  }

  async onModuleInit() {
    this.logger.log('Bootstrapping');
    const subscriber = await this.redisService.getClient(
      REDIS_CLIENTS.SUBSCRIBE,
    );
    const publisher = await this.redisService.getClient(REDIS_CLIENTS.PUBLISH);
    this.logger.log('Waiting for redis to be ready');

    if (subscriber.status == 'ready') {
      this.initializeClient(subscriber);
    }

    subscriber.on(REDIS_EVENT_TYPES.READY, async () => {
      this.initializeClient(subscriber);
    });
    subscriber.on(REDIS_EVENT_TYPES.RECONNECTING, () => {
      this.logger.debug('Attempting to reconnect to redis...');
    });
    publisher.on(REDIS_EVENT_TYPES.ERROR, (err) => {
      this.logger.error(err);
    });
    subscriber.on(REDIS_EVENT_TYPES.ERROR, (err) => {
      this.logger.error(err);
    });
    publisher.on(REDIS_EVENT_TYPES.END, () => {
      this.logger.log('Connection ended');
    });
    subscriber.on(REDIS_EVENT_TYPES.END, () => {
      this.logger.log('Connection ended');
    });
    publisher.on(REDIS_EVENT_TYPES.CLOSE, () => {
      this.logger.log('Connection closed');
    });
    subscriber.on(REDIS_EVENT_TYPES.CLOSE, () => {
      this.logger.log('Connection closed');
    });
  }
}
