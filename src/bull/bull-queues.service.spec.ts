import { ConfigService } from '@app/config';
import { LoggerModule } from '@app/logger';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { TypedEmitter } from 'tiny-typed-emitter2';
import { BullQueuesService } from './bull-queues.service';
import { EVENT_TYPES } from './bull.enums';
import { BullQueuesServiceEvents } from './bull.interfaces';
import { BullModule } from './bull.module';
import { BullMQMetricsFactory } from './bullmq-metrics.factory';

/**
 * IMPORTANT: Redis **MUST** be running or this test suite will fail
 */

describe(BullQueuesService.name, () => {
  let service: BullQueuesService;
  let config: ConfigService;
  let events: TypedEmitter<BullQueuesServiceEvents>;
  let redis: Redis;

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
        const qu = new Queue(expectedQueueName, {
          connection: {
            host: config.config.REDIS_HOST,
            port: config.config.REDIS_PORT,
          },
        });

        qu.obliterate();
      });

      events.on(EVENT_TYPES.QUEUE_REMOVED, (event) => {
        expect(event.queueName).toEqual(expectedQueueName);
        done();
      });

      service.onModuleInit();
    });
  });

  describe('Existing Queues', () => {
    beforeEach(async () => {
      for (let i = 0; i < 5; i++) {
        const queue = new Queue(`test-${i}`, {
          connection: redis,
        });

        await queue.waitUntilReady();
      }
    });

    it.only('works', (done) => {
      events.on(EVENT_TYPES.QUEUE_SERVICE_READY, () => {
        expect(service.getLoadedQueues().length).toEqual(5);
        done();
      });

      service.onModuleInit();

      /*
      Promise.all(promises).then(() => {
        service.onModuleInit();
      });
      */
    }, 5000);
  });

  // loss of connectivity

  /**
   * Items to test
   * - Create job queue in prefix (and not in prefix)
   * - Remove job
   * - Recreate redis queue
   * - Loss of connectivity
   */
});
