import { Injectable, OnModuleInit } from "@nestjs/common";
import {RedisService} from 'nestjs-redis';
import { ConfigService } from "src/config/config.service";
import { InjectLogger, LoggerService } from "src/logger";
import Bull from "bull";
import { Mutex } from "async-mutex";
import { EventEmitter2 } from "eventemitter2";
import { EVENT_TYPES, REDIS_EVENT_TYPES } from "./bull.enums";
import { IQueueCreatedEvent, IQueueRemovedEvent } from "./bull.interfaces";

@Injectable()
export class BullQueuesService implements OnModuleInit {
    private readonly _queues: {[queueName: string]: Bull.Queue} = {};

    constructor(
        private readonly eventEmitter: EventEmitter2,
        @InjectLogger(BullQueuesService)
        private readonly logger: LoggerService,
        private readonly redisService: RedisService,
        private readonly configService: ConfigService) {}

    private async processMessage(eventType: REDIS_EVENT_TYPES, queueName: string) {
        const mutex = new Mutex();
        return await mutex.runExclusive(async () => {
            switch (eventType) {
                case REDIS_EVENT_TYPES.SET:
                    await this.addQueue(queueName);
                    break;
                case REDIS_EVENT_TYPES.DELETE:
                    await this.removeQueue(queueName);
                    break;
                default:
                    this.logger.debug(`Ignoring event '${eventType}'`);
            }
        })
    }

    private addQueue(queueName: string) {
        this.logger.debug(`Attempting to add queue: ${queueName}`)
        if (!(queueName in this._queues)) {
            this.logger.log(`Adding queue: ${queueName}`)
            this._queues[queueName] = new Bull(queueName, {
                redis: {
                    host: this.configService.config.REDIS_HOST,
                    port: this.configService.config.REDIS_PORT
                }
            })
            this.eventEmitter.emit(EVENT_TYPES.QUEUE_CREATED, {
                queueName,
                queuePrefix: 'bull',
                queue: this._queues[queueName]
            } as IQueueCreatedEvent)
        }
    }

    private removeQueue(queueName: string) {
        this.logger.debug(`Attempting to remove queue: ${queueName}`)
        if (queueName in this._queues) {
            this.logger.log(`Removing queue: ${queueName}`)
            this.eventEmitter.emit(EVENT_TYPES.QUEUE_REMOVED, {
                queueName,
                queuePrefix: 'bull',
                queue: this._queues[queueName]
            } as IQueueRemovedEvent)
            delete this._queues[queueName]
        }
    }

    async onModuleInit() {
        this.logger.log('Bootstrapping')
        const client = await this.redisService.getClient();
        
        this.logger.log("Enabling notify-keyspace-events");
        // TODO: find a way to ensure this config is set and then reboot
        //await client.config("SET","notify-keyspace-events","KEA");
        //await client.disconnect();
        //await client.connect();

        this.logger.log("Waiting for redis to be ready");
        client.on('ready', async () => {
            this.logger.log('Redis connection READY! Configuring watchers for bull queues.')

            const queuePrefixes = this.configService.config.BULL_WATCH_QUEUE_PREFIXES.split(',').map(item => item.trim());
            // loop through each queue prefix and add anything
            // we find
            for (const queuePrefix of queuePrefixes) {
                this.logger.log(`Loading queues from queuePrefix: '${queuePrefix}'`);
                
                // TODO: fix this implementation (right now this parsing every job
                // which will be slow if there are many jobs in redis!!!)
                // add queues we find
                for (const key of await client.keys(`${queuePrefix}:*`)) {
                    this.addQueue(key.match(/^[^:]+:([^:]+):/)[1]);
                }

                // subscribe to keyspace events
                client.psubscribe(`__keyspace@0__:${queuePrefix}:*:stalled-check`, (err, count) => {
                    this.logger.log(`Subscribed to keyspace events for ${queuePrefix}`);
                })
            }

            // logic to handle incoming events
            client.on('pmessage', async (pattern, channel, message) => {
                await this.processMessage(message as REDIS_EVENT_TYPES, channel.match(/:([^:]+):stalled-check$/)[1]);
            })

        })
        client.on('error', (err) => {
            this.logger.error(err);
        })
        client.on('end', () => {
            this.logger.log('Connection closed, good bye.');
        })
    }
}