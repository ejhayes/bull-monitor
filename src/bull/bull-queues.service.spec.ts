import { ConfigService } from '@app/config';
import { LoggerModule } from '@app/logger';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
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

const redisHost = process.env.REDIS_HOST;
const redisPort = Number(process.env.REDIS_PORT);

describe(BullQueuesService.name, () => {
  let moduleRef: TestingModule;
  let service: BullQueuesService;
  let config: ConfigService;
  let events: TypedEmitter<BullQueuesServiceEvents>;
  let redis: Redis;

  beforeAll(async () => {
    redis = new Redis(redisPort, redisHost);
  });

  afterAll(async () => {
    await redis.quit();
  });

  beforeEach(async () => {
    await redis.flushall('SYNC');

    moduleRef = await Test.createTestingModule({
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
    await moduleRef.close();
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
      let queue: Queue;

      events.on(EVENT_TYPES.QUEUE_SERVICE_READY, () => {
        queue = new Queue(expectedQueueName, {
          connection: {
            host: redisHost,
            port: redisPort,
          },
        });
        queue.on('error', jest.fn());
      });

      events.on(EVENT_TYPES.QUEUE_CREATED, (event) => {
        expect(event.queueName).toEqual(expectedQueueName);
        queue.disconnect().then(() => done());
      });

      service.onModuleInit();
    });

    it('detects a removed queue', (done) => {
      const expectedQueueName = 'expectedRemovedQueue';
      let queue: Queue;

      events.on(EVENT_TYPES.QUEUE_SERVICE_READY, () => {
        queue = new Queue(expectedQueueName, {
          connection: {
            host: config.config.REDIS_HOST,
            port: config.config.REDIS_PORT,
          },
        });

        queue.on('error', jest.fn());

        queue.pause().then(() => {
          queue.obliterate();
        });
      });

      events.on(EVENT_TYPES.QUEUE_REMOVED, (event) => {
        expect(event.queueName).toEqual(expectedQueueName);
        queue.disconnect().then(() => done());
      });

      service.onModuleInit();
    }, 5000);
  });

  describe('Existing Queues', () => {
    it('loads queues that already exist in redis', (done) => {
      const expectedQueueSize = 5;
      const queues = [];

      for (let i = 0; i < expectedQueueSize; i++) {
        const queue = new Queue(`test-${i}`, {
          connection: {
            host: redisHost,
            port: redisPort,
            reconnectOnError: () => false,
          },
        });
        queue.on('error', jest.fn());

        queues.push(queue);
      }

      events.on(EVENT_TYPES.QUEUE_SERVICE_READY, () => {
        expect(service.getLoadedQueues().length).toEqual(expectedQueueSize);

        Promise.all(queues.map((q) => q.disconnect())).then(() => done());
      });

      Promise.all(queues.map((q) => q.waitUntilReady())).then(() => {
        service.onModuleInit();
      });
    });
  });

  describe('Network Connectivity Issues', () => {
    it('captures new queues after loss of connectivity', (done) => {
      const queue = new Queue('some-dummy-1', {
        connection: {
          host: redisHost,
          port: redisPort,
          reconnectOnError: () => false,
        },
      });
      let otherQueue: Queue;
      queue.on('error', jest.fn());

      const eventFn = jest
        .fn()
        .mockImplementationOnce(() => {
          return redis.client('KILL', 'SKIPME', 'YES').then(() => {
            otherQueue = new Queue('some-dummy-2', {
              connection: {
                host: redisHost,
                port: redisPort,
                reconnectOnError: () => false,
              },
            });
            otherQueue.on('error', jest.fn());

            otherQueue.waitUntilReady().then(() => {
              expect(service.getLoadedQueues().length).toEqual(1);
            });
          });
        })
        .mockImplementationOnce(() => {
          expect(service.getLoadedQueues().length).toEqual(2);
          Promise.all([queue.disconnect(), otherQueue.disconnect()]).then(
            () => {
              done();
            },
          );
        });

      events.on(EVENT_TYPES.QUEUE_SERVICE_READY, eventFn);

      queue.waitUntilReady().then(() => {
        service.onModuleInit();
      });
    }, 5000);

    it('captures removed queues after loss of connectivity', (done) => {
      const expectedRemovalQueue = 'dummy-remove-queue-1';
      const queue = new Queue(expectedRemovalQueue, {
        connection: {
          host: redisHost,
          port: redisPort,
          reconnectOnError: () => false,
        },
      });
      queue.on('error', jest.fn());
      const removeFn = jest.fn();

      const eventFn = jest
        .fn()
        .mockImplementationOnce(() => {
          expect(service.getLoadedQueues().length).toEqual(1);

          events.on(EVENT_TYPES.QUEUE_REMOVED, removeFn);

          /**
           * Need to ensure the delete happens before reconnection occurs
           */
          return redis.client('KILL', 'SKIPME', 'YES').then(() => {
            return queue.obliterate();
          });
        })
        .mockImplementationOnce(() => {
          expect(removeFn).toHaveBeenCalledWith(
            expect.objectContaining({
              queueName: expectedRemovalQueue,
              queuePrefix: 'bull',
            }),
          );

          /**
           * Client is killed and starts reconnect attempt right away
           */
          expect(service.getLoadedQueues().length).toEqual(0);

          queue.disconnect().then(() => done());
        });

      events.on(EVENT_TYPES.QUEUE_SERVICE_READY, eventFn);

      queue.waitUntilReady().then(() => {
        service.onModuleInit();
      });
    });
  });
});
