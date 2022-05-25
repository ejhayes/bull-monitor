import { ConfigService } from '@app/config';
import { LoggerModule } from '@app/logger';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { TypedEmitter } from 'tiny-typed-emitter2';
import { BullQueuesService } from './bull-queues.service';
import { EVENT_TYPES, REDIS_CLIENTS } from './bull.enums';
import { BullQueuesServiceEvents } from './bull.interfaces';
import { BullModule } from './bull.module';
import { BullMQMetricsFactory } from './bullmq-metrics.factory';
import { RedisService } from 'nestjs-redis';

/**
 * IMPORTANT: Redis **MUST** be running or this test suite will fail
 */

describe(BullQueuesService.name, () => {
  let service: BullQueuesService;
  let config: ConfigService;
  let events: TypedEmitter<BullQueuesServiceEvents>;
  let redis: Redis;
  let redisClient: RedisService;

  beforeAll(async () => {
    redis = new Redis(Number(process.env.REDIS_PORT), process.env.REDIS_PORT);
  });

  beforeEach(async () => {
    // must be enab led for this to work
    process.env.REDIS_CONFIGURE_KEYSPACE_NOTIFICATIONS = '1';

    await redis.flushall();

    const moduleRef = await Test.createTestingModule({
      imports: [
        LoggerModule.forRoot({}),
        EventEmitterModule.forRoot(),
        BullModule,
      ],
    })
      .overrideProvider(BullMQMetricsFactory)
      .useValue(jest.fn())
      .compile();

    service = await moduleRef.resolve(BullQueuesService);
    config = moduleRef.get(ConfigService);
    events = await moduleRef.resolve(TypedEmitter);
    redisClient = await moduleRef.resolve(RedisService);
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  describe('No Queues', () => {
    it('is initially empty', (done) => {
      events.on(EVENT_TYPES.QUEUE_SERVICE_READY, () => {
        expect(service.getLoadedQueues()).toEqual([]);
        done();
      });

      service.onModuleInit();
    });

    it('detects new queue', (done) => {
      const expectedQueueName = 'expectedQueueName';

      events.on(EVENT_TYPES.QUEUE_SERVICE_READY, () => {
        new Queue(expectedQueueName, {
          connection: {
            host: config.config.REDIS_HOST,
            port: config.config.REDIS_PORT,
          },
        });
      });

      events.on(EVENT_TYPES.QUEUE_CREATED, (event) => {
        expect(event.queueName).toEqual(expectedQueueName);
        done();
      });

      service.onModuleInit();
    });

    it('detects a removed queue', (done) => {
      const expectedQueueName = 'expectedRemovedQueue';

      events.on(EVENT_TYPES.QUEUE_SERVICE_READY, () => {
        const queue = new Queue(expectedQueueName, {
          connection: {
            host: config.config.REDIS_HOST,
            port: config.config.REDIS_PORT,
          },
        });

        queue.pause().then(() => {
          queue.obliterate();
        });
      });

      events.on(EVENT_TYPES.QUEUE_REMOVED, (event) => {
        expect(event.queueName).toEqual(expectedQueueName);
        done();
      });

      service.onModuleInit();
    });
  });

  describe('Existing Queues', () => {
    it('loads queues that already exist in redis', (done) => {
      const expectedQueueSize = 5;
      const promises = [];

      for (let i = 0; i < expectedQueueSize; i++) {
        const queue = new Queue(`test-${i}`, {
          connection: redis,
        });

        promises.push(queue.waitUntilReady());
      }

      events.on(EVENT_TYPES.QUEUE_SERVICE_READY, () => {
        expect(service.getLoadedQueues().length).toEqual(expectedQueueSize);
        done();
      });

      Promise.all(promises).then(() => {
        service.onModuleInit();
      });
    });
  });

  it('captures new queues after loss of connectivity', (done) => {
    const queue = new Queue('some-dummy-1', {
      connection: redis,
    });

    const eventFn = jest
      .fn()
      .mockImplementationOnce(() => {
        return redis.client('KILL', 'SKIPME', 'YES').then(() => {
          const otherQueue = new Queue('some-dummy-2', {
            connection: redis,
          });

          otherQueue.waitUntilReady().then(() => {
            expect(service.getLoadedQueues().length).toEqual(1);
          });
        });
      })
      .mockImplementationOnce(() => {
        expect(service.getLoadedQueues().length).toEqual(2);
        done();
      });

    events.on(EVENT_TYPES.QUEUE_SERVICE_READY, eventFn);

    queue.waitUntilReady().then(() => {
      service.onModuleInit();
    });
  });

  // TODO: not working. there is a timing issue where the queue/queuescheduler
  // instances created here wind up recreating the queue configuration in redis
  // even if we have attempted to delete this information. to recreate this issue:
  // - kill all redis connections
  // - delete bullmq key from redis over a new connection
  /*
  it('captures removed queues after loss of connectivity', (done) => {
    const expectedRemovalQueue = 'dummy-remove-queue-1';
    const queue = new Queue(expectedRemovalQueue, {
      connection: redis,
    });

    const eventFn = jest
      .fn()
      .mockImplementationOnce(() => {
        expect(service.getLoadedQueues().length).toEqual(1);

        return queue.close().then(() => {
          return redis.client('KILL', 'SKIPME', 'YES').then(() => {
            return redis.del(`bull:${expectedRemovalQueue}:meta`);
          });
        });
      })
      .mockImplementationOnce(() => {
        expect(service.getLoadedQueues().length).toEqual(0);
        done();
      });

    events.on(EVENT_TYPES.QUEUE_SERVICE_READY, eventFn);

    queue.waitUntilReady().then(() => {
      service.onModuleInit();
    });
  });
  */

  // loss of connectivity

  /**
   * Items to test
   * - Create job queue in prefix (and not in prefix)
   * - Remove job
   * - Recreate redis queue
   * - Loss of connectivity
   */
});
