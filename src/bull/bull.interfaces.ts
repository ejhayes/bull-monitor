import {Queue} from 'bull'

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
