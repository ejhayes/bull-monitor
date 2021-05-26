import { ConfigService } from '@app/config/config.service';
import { InjectLogger, LoggerService } from '@app/logger';
import { InjectMetrics, MetricsService } from '@app/metrics';
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EVENT_TYPES } from './bull.enums';
import { QueueCreatedEvent, QueueRemovedEvent } from './bull.interfaces';
import { BullMQMetricsFactory } from './bullmq-metrics.factory';

@Injectable()
export class BullMetricsService {
  private readonly _queues: {
    [queueName: string]: ReturnType<BullMQMetricsFactory['create']>;
  } = {};

  constructor(
    @InjectLogger(BullMetricsService)
    private readonly logger: LoggerService,
    private readonly configService: ConfigService,
    private readonly metricsFactory: BullMQMetricsFactory,
  ) {
    this.logger.debug(
      `Checking queue metrics every ${configService.config.BULL_COLLECT_QUEUE_METRICS_INTERVAL_MS}ms`,
    );
  }

  @OnEvent(EVENT_TYPES.QUEUE_CREATED)
  private addQueueMetrics(event: QueueCreatedEvent) {
    this.logger.log(`Adding queue metrics for ${event.uniqueName}`);
    //this._queues[event.uniqueName] = this.queueMetrics.start(event.queue);
    this._queues[event.uniqueName] = this.metricsFactory.create(
      event.queuePrefix,
      event.queueName,
      event.queue,
    );
  }

  @OnEvent(EVENT_TYPES.QUEUE_REMOVED)
  private removeQueueMetrics(event: QueueRemovedEvent) {
    this.logger.log(`Removing queue metrics for ${event.uniqueName}`);
    this._queues[event.uniqueName].remove();
    delete this._queues[event.uniqueName];
  }
}
