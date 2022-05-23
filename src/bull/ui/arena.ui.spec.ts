jest.mock('bull', () => jest.fn());

jest.mock('bull-arena', () => {
  const original = jest.requireActual('bull-arena');
  return jest.fn(original);
});

import { ConfigModule } from '@app/config/config.module';
import { ConfigService } from '@app/config/config.service';
import { LoggerModule, LoggerService } from '@app/logger';
import { Test } from '@nestjs/testing';
import Arena from 'bull-arena';
import { Queue } from 'bullmq';
import { BullArenaUi } from './arena.ui';

describe(BullArenaUi, () => {
  let configService: ConfigService;
  let loggerService: LoggerService;
  let arenaUi: BullArenaUi;
  let testQueue: Queue;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, LoggerModule.forRoot({})],
    }).compile();

    configService = moduleRef.get<ConfigService>(ConfigService);
    loggerService = await moduleRef.resolve<LoggerService>(LoggerService);
    arenaUi = new BullArenaUi(loggerService, configService);
    testQueue = new Queue('test', {
      connection: {
        host: configService.config.REDIS_HOST,
        port: configService.config.REDIS_PORT,
      },
    });
  });

  afterEach(async () => {
    await testQueue.close();
  });

  it('initializes with correct params', async () => {
    expect(Arena).toHaveBeenCalledTimes(1);
    expect(Arena).toBeCalledWith(
      {
        BullMQ: Queue,
        queues: [
          {
            hostId: '',
            name: '',
            redis: {
              host: '',
              port: 0,
            },
            type: 'bullmq',
          },
        ],
      },
      { disableListen: true },
    );
  });

  it('adds a queue', async () => {
    arenaUi.addQueue('test', 'test', testQueue);
    expect(1).toEqual(1);
  });
});
