import { RequestHandler } from '@nestjs/common/interfaces'
import { Queue } from 'bull'

export interface IBullUi {
    addQueue(queuePrefix: string, queueName: string, queue: Queue): void
    removeQueue(queuePrefix: string, queueName: string): void
    middleware: RequestHandler
}
export interface IQueueCreatedEvent {
    /**
     * Queue name that was created
     */
    queueName: string
    /**
     * Queue prefix
     */
    queuePrefix: string
    /**
     * Bull queue
     */
    queue: Queue
}

export interface IQueueRemovedEvent {
    /**
     * Queue name that was removed
     */
    queueName: string
    /**
     * Queue prefix
     */
    queuePrefix: string
}
