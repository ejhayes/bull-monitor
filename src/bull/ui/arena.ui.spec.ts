
jest.mock('bull', () => jest.fn());

/*
const originalQueue = jest.requireActual('bull-arena/src/server/queue');
const mockedQueue = jest.fn(() => jest.fn(originalQueue))

jest.mock('bull-arena/src/server/queue', () => mockedQueue)
*/


jest.mock('bull-arena', () => {
    const original = jest.requireActual('bull-arena')
    return jest.fn(original)
});

import { Test } from '@nestjs/testing';
import { BullArenaUi } from './arena.ui';
import Arena from 'bull-arena';
import Bull from 'bull';
import ArenaQueue from 'bull-arena/src/server/queue'
import {LoggerModule, LoggerService} from '@app/logger'
import { ConfigService } from '@app/config/config.service';
import { ConfigModule } from "@app/config/config.module";

describe(BullArenaUi, () => {
    let configService: ConfigService;
    let loggerService: LoggerService;
    let arenaUi: BullArenaUi;

    beforeEach(async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [
                ConfigModule,
                LoggerModule.forRoot({}),
            ]
        }).compile();

        /*
        jest.mock("express", () => {
            Router: () => jest.fn()
        });
        */
        
        configService = moduleRef.get<ConfigService>(ConfigService);
        loggerService = await moduleRef.resolve<LoggerService>(LoggerService);
        arenaUi = new BullArenaUi(loggerService, configService);
    })

    it('initializes with correct params', async () => {
        expect(Arena).toHaveBeenCalledTimes(1);
        expect(Arena).toBeCalledWith({
            Bull: Bull,
            queues: [{
                hostId: "",
                name: "",
                redis: {
                    host: "",
                    port: 0
                },
                type: "bull"
            }
            ]
        },{disableListen: true});
        // TODO: expect queues to be empty
        //expect(ArenaQueue).toBeCalledTimes(1)
        
        //arenaUi.addQueue('blah-prefix','blah-name', queue)
    })

    it('adds a queue', async () => {
        const testQueue = new Bull('test')
        arenaUi.addQueue('test','test', testQueue)
        //expect(ArenaQueue).toBeCalledWith([1])
        // TODO: expect one queue
        // TODO: no error thrown
    })
})