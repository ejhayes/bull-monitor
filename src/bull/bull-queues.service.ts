import { Injectable, OnModuleInit } from "@nestjs/common";
import {RedisService} from 'nestjs-redis';
import { ConfigService } from "src/config/config.service";
import { InjectLogger, LoggerService } from "src/logger";
import Bull from "bull";
import { Mutex } from "async-mutex";
import { EventEmitter2 } from "eventemitter2";
import { EVENT_TYPES, REDIS_CLIENTS, REDIS_EVENT_TYPES } from "./bull.enums";
import { QueueCreatedEvent, QueueRemovedEvent } from "./bull.interfaces";

const BULL_QUEUE_REGEX = /(?<queuePrefix>^[^:]+):(?<queueName>[^:]+):/
const BULL_KEYSPACE_REGEX = /(?<queuePrefix>[^:]+):(?<queueName>[^:]+):stalled-check$/
const parseBullQueue = (key: string) => {
    const MATCHER = key.match(/:stalled-check$/) ? BULL_KEYSPACE_REGEX : BULL_QUEUE_REGEX
    const match = key.match(MATCHER)
    return {
        queuePrefix: match.groups?.queuePrefix ? match.groups.queuePrefix : 'unknown',
        queueName: match.groups?.queueName ? match.groups.queueName : 'unknown'
    }
}
@Injectable()
export class BullQueuesService implements OnModuleInit {
    private readonly _queues: {[queueName: string]: Bull.Queue} = {};

    constructor(
        private readonly eventEmitter: EventEmitter2,
        @InjectLogger(BullQueuesService)
        private readonly logger: LoggerService,
        private readonly redisService: RedisService,
        private readonly configService: ConfigService) {}

    private async processMessage(eventType: REDIS_EVENT_TYPES, queuePrefix: string, queueName: string) {
        const mutex = new Mutex();
        return await mutex.runExclusive(async () => {
            switch (eventType) {
                case REDIS_EVENT_TYPES.SET:
                    await this.addQueue(queuePrefix, queueName);
                    break;
                case REDIS_EVENT_TYPES.DELETE:
                    await this.removeQueue(queuePrefix, queueName);
                    break;
                default:
                    this.logger.debug(`Ignoring event '${eventType}'`);
            }
        })
    }

    private addQueue(queuePrefix: string, queueName: string) {
        const queueKey = `${queuePrefix}-${queueName}`
        this.logger.debug(`Attempting to add queue: ${queueKey}`)
        if (!(queueKey in this._queues)) {
            this.logger.log(`Adding queue: ${queueKey}`)
            this._queues[queueKey] = new Bull(queueName, {
                prefix: queuePrefix,
                redis: {
                    host: this.configService.config.REDIS_HOST,
                    port: this.configService.config.REDIS_PORT
                }
            })
            this.eventEmitter.emit(
                EVENT_TYPES.QUEUE_CREATED,
                new QueueCreatedEvent(queuePrefix, this._queues[queueKey])
            )
        }
    }

    private removeQueue(queuePrefix: string, queueName: string) {
        const queueKey = `${queuePrefix}-${queueName}`
        this.logger.debug(`Attempting to remove queue: ${queueKey}`)
        if (queueKey in this._queues) {
            this.logger.log(`Removing queue: ${queueKey}`)
            this.eventEmitter.emit(
                EVENT_TYPES.QUEUE_REMOVED,
                new QueueRemovedEvent(queuePrefix, queueName)
            )
            delete this._queues[queueKey]
        }
    }

    private async findAndPopulateQueues(match: string): Promise<void> {
        const client = await this.redisService.getClient(REDIS_CLIENTS.PUBLISH)
        return new Promise((resolve, reject) => {
            client.scanStream({ type: "string", match, count: 100 })
            .on('data', (keys: string[]) => {
                for (const key of keys) {
                    let queueMatch = parseBullQueue(key)
                    this.addQueue(queueMatch.queuePrefix, queueMatch.queueName)
                }
            })
            .on('end', () => {
                resolve()
            })
            .on('error', (err) => {
                this.logger.error('SOmehitng bad hapened')
                this.logger.error(`${err.stack}`);
                reject(err)
            })
        })
    }

    async onModuleInit() {
        this.logger.log('Bootstrapping')
        const client = await this.redisService.getClient(REDIS_CLIENTS.SUBSCRIBE);
        
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
                
                await Promise.all([
                    this.findAndPopulateQueues(`${queuePrefix}:*:stalled-check`),
                    this.findAndPopulateQueues(`${queuePrefix}:*:id`)
                ])
                .catch((err) => {
                    this.logger.error(`Ooops something happened: ${err}`)
                })

                // subscribe to keyspace events
                client.psubscribe(`__keyspace@0__:${queuePrefix}:*:stalled-check`, (err, count) => {
                    this.logger.log(`Subscribed to keyspace events for ${queuePrefix}`);
                })
            }

            // logic to handle incoming events
            client.on('pmessage', async (pattern: string, channel: string, message: string) => {
                const queueMatch = parseBullQueue(channel);
                await this.processMessage(message as REDIS_EVENT_TYPES, queueMatch.queuePrefix, queueMatch.queueName);
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