import { RequestHandler } from '@nestjs/common/interfaces';
import { Queue } from 'bullmq';

export interface IBullUi {
  addQueue(queuePrefix: string, queueName: string, queue: Queue): void;
  middleware: RequestHandler;
  removeQueue(queuePrefix: string, queueName: string): void;
}
export class QueueCreatedEvent {
  /**
   * Queue name that was created
   */
  readonly queueName: string;
  /**
   * Queue prefix
   */
  readonly queuePrefix: string;
  /**
   * Bull queue
   */
  readonly queue: Queue;

  constructor(queuePrefix: string, queue: Queue) {
    this.queue = queue;
    this.queuePrefix = queuePrefix;
    this.queueName = queue.name;
  }

  /**
   * Unique queue name
   */
  get uniqueName() {
    return `${this.queuePrefix}-${this.queueName}`;
  }
}

export class QueueRemovedEvent {
  /**
   * Queue name that was removed
   */
  readonly queueName: string;
  /**
   * Queue prefix
   */
  readonly queuePrefix: string;

  constructor(queuePrefix: string, queueName: string) {
    this.queuePrefix = queuePrefix;
    this.queueName = queueName;
  }

  /**
   * Unique queue name
   */
  get uniqueName() {
    return `${this.queuePrefix}-${this.queueName}`;
  }
}
