import { ConfigService } from '@app/config/config.service';
import { InjectMetrics, MetricsService } from '@app/metrics';
import { Injectable } from '@nestjs/common';
import { Job, Queue, QueueEvents } from 'bullmq';

enum LABEL_NAMES {
  FAIL_TYPE = 'fail_type',
  JOB_NAME = 'job_name',
  QUEUE_NAME = 'queue_name',
  QUEUE_PREFIX = 'queue_prefix',
  STATUS = 'status',
}

enum STATUS_TYPES {
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Injectable()
export class BullMQMetricsFactory {
  private readonly jobs_completed_total: ReturnType<
    MetricsService['createGauge']
  >;
  private readonly jobs_failed_total: ReturnType<MetricsService['createGauge']>;
  private readonly jobs_delayed_total: ReturnType<
    MetricsService['createGauge']
  >;
  private readonly jobs_active_total: ReturnType<MetricsService['createGauge']>;
  private readonly jobs_waiting_total: ReturnType<
    MetricsService['createGauge']
  >;

  private readonly jobs_active: ReturnType<MetricsService['createCounter']>;
  private readonly jobs_waiting: ReturnType<MetricsService['createCounter']>;
  private readonly jobs_stalled: ReturnType<MetricsService['createCounter']>;
  private readonly jobs_failed: ReturnType<MetricsService['createCounter']>;
  private readonly jobs_completed: ReturnType<MetricsService['createCounter']>;
  private readonly jobs_delayed: ReturnType<MetricsService['createCounter']>;
  private readonly job_duration: ReturnType<MetricsService['createSummary']>;
  private readonly job_wait_duration: ReturnType<
    MetricsService['createSummary']
  >;
  private readonly job_attempts: ReturnType<MetricsService['createSummary']>;

  constructor(
    private readonly configService: ConfigService,
    @InjectMetrics()
    metricsService: MetricsService,
  ) {
    this.jobs_active_total = metricsService.createGauge({
      name: 'jobs_active_total',
      help: 'Total active jobs',
      labelNames: [
        LABEL_NAMES.QUEUE_PREFIX,
        LABEL_NAMES.QUEUE_NAME,
        LABEL_NAMES.JOB_NAME,
      ],
    });
    this.jobs_completed_total = metricsService.createGauge({
      name: 'jobs_completed_total',
      help: 'Total completed jobs',
      labelNames: [
        LABEL_NAMES.QUEUE_PREFIX,
        LABEL_NAMES.QUEUE_NAME,
        LABEL_NAMES.JOB_NAME,
      ],
    });;
    this.jobs_failed_total = metricsService.createGauge({
      name: 'jobs_failed_total',
      help: 'Total failed jobs',
      labelNames: [
        LABEL_NAMES.QUEUE_PREFIX,
        LABEL_NAMES.QUEUE_NAME,
        LABEL_NAMES.JOB_NAME,
      ],
    });;
    this.jobs_waiting_total = metricsService.createGauge({
      name: 'jobs_waiting_total',
      help: 'Total waiting jobs',
      labelNames: [
        LABEL_NAMES.QUEUE_PREFIX,
        LABEL_NAMES.QUEUE_NAME,
        LABEL_NAMES.JOB_NAME,
      ],
    });;
    this.jobs_delayed_total = metricsService.createGauge({
      name: 'jobs_delayed_total',
      help: 'Total delayed jobs',
      labelNames: [
        LABEL_NAMES.QUEUE_PREFIX,
        LABEL_NAMES.QUEUE_NAME,
        LABEL_NAMES.JOB_NAME,
      ],
    });;
    this.jobs_active = metricsService.createCounter({
      name: 'jobs_active',
      help: 'Number of active jobs',
      labelNames: [
        LABEL_NAMES.QUEUE_PREFIX,
        LABEL_NAMES.QUEUE_NAME,
        LABEL_NAMES.JOB_NAME,
      ],
    });
    this.jobs_waiting = metricsService.createCounter({
      name: 'jobs_waiting',
      help: 'Number of waiting jobs',
      labelNames: [
        LABEL_NAMES.QUEUE_PREFIX,
        LABEL_NAMES.QUEUE_NAME,
        LABEL_NAMES.JOB_NAME,
      ],
    });
    this.jobs_failed = metricsService.createCounter({
      name: 'jobs_failed',
      help: 'Number of failed jobs',
      labelNames: [
        LABEL_NAMES.QUEUE_PREFIX,
        LABEL_NAMES.QUEUE_NAME,
        LABEL_NAMES.JOB_NAME,
        LABEL_NAMES.FAIL_TYPE,
      ],
    });
    this.jobs_completed = metricsService.createCounter({
      name: 'jobs_completed',
      help: 'Number of completed jobs',
      labelNames: [
        LABEL_NAMES.QUEUE_PREFIX,
        LABEL_NAMES.QUEUE_NAME,
        LABEL_NAMES.JOB_NAME,
      ],
    });
    this.jobs_stalled = metricsService.createCounter({
      name: 'jobs_stalled',
      help: 'Number of stalled jobs',
      labelNames: [
        LABEL_NAMES.QUEUE_PREFIX,
        LABEL_NAMES.QUEUE_NAME,
        LABEL_NAMES.JOB_NAME,
      ],
    });
    this.jobs_delayed = metricsService.createCounter({
      name: 'jobs_delayed',
      help: 'Number of delayed jobs',
      labelNames: [
        LABEL_NAMES.QUEUE_PREFIX,
        LABEL_NAMES.QUEUE_NAME,
        LABEL_NAMES.JOB_NAME,
      ],
    });
    this.job_duration = metricsService.createSummary({
      name: 'job_duration',
      help: 'Job duration',
      labelNames: [
        LABEL_NAMES.QUEUE_PREFIX,
        LABEL_NAMES.QUEUE_NAME,
        LABEL_NAMES.JOB_NAME,
        LABEL_NAMES.STATUS,
      ],
    });
    this.job_wait_duration = metricsService.createSummary({
      name: 'job_wait_duration',
      help: 'Job waiting duration',
      labelNames: [
        LABEL_NAMES.QUEUE_PREFIX,
        LABEL_NAMES.QUEUE_NAME,
        LABEL_NAMES.JOB_NAME,
        LABEL_NAMES.STATUS,
      ],
    });
    this.job_attempts = metricsService.createSummary({
      name: 'job_attempts',
      help: 'Job attempts',
      labelNames: [
        LABEL_NAMES.QUEUE_PREFIX,
        LABEL_NAMES.QUEUE_NAME,
        LABEL_NAMES.JOB_NAME,
        LABEL_NAMES.STATUS,
      ],
    });
  }

  recordJobMetrics(
    labels: Record<string, string>,
    status: STATUS_TYPES,
    job: Job,
  ) {
    if (!job.finishedOn) {
      return;
    }
    const jobLabels = {
      [LABEL_NAMES.STATUS]: status,
      ...(status == STATUS_TYPES.FAILED
        ? { [LABEL_NAMES.FAIL_TYPE]: job.failedReason }
        : {}),
      ...labels,
    };
    const jobDuration = job.finishedOn - job.processedOn;
    this.job_duration.observe(jobLabels, jobDuration);
    this.job_wait_duration.observe(jobLabels, job.processedOn - job.timestamp);
    this.job_attempts.observe(jobLabels, job.attemptsMade);
  }

  create(queuePrefix: string, queueName: string, queue: Queue) {
    const labels = {
      [LABEL_NAMES.QUEUE_PREFIX]: queuePrefix,
      [LABEL_NAMES.QUEUE_NAME]: queueName,
    };
    const queueEvents = new QueueEvents(queueName, {
      prefix: queuePrefix,
      connection: {
        host: this.configService.config.REDIS_HOST,
        port: this.configService.config.REDIS_PORT,
      },
    });

    queueEvents.on('stalled', async (event) => {
      const job = await queue.getJob(event.jobId);
      const jobLabels = {
        [LABEL_NAMES.JOB_NAME]: job.name,
        ...labels,
      };
      this.jobs_stalled.inc(jobLabels, 1);
    });
    queueEvents.on('active', async (event) => {
      const job = await queue.getJob(event.jobId);
      const jobLabels = {
        [LABEL_NAMES.JOB_NAME]: job.name,
        ...labels,
      };
      this.jobs_active.inc(jobLabels, 1);
    });
    queueEvents.on('waiting', async (event) => {
      const job = await queue.getJob(event.jobId);
      const jobLabels = {
        [LABEL_NAMES.JOB_NAME]: job.name,
        ...labels,
      };
      this.jobs_waiting.inc(jobLabels, 1);
    });
    queueEvents.on('failed', async (event) => {
      const job = await queue.getJob(event.jobId);
      const jobLabels = {
        [LABEL_NAMES.JOB_NAME]: job.name,
        [LABEL_NAMES.FAIL_TYPE]: event.failedReason,
        ...labels,
      };
      this.jobs_failed.inc(jobLabels, 1);
      this.recordJobMetrics(labels, STATUS_TYPES.FAILED, job);
    });
    queueEvents.on('delayed', async (event) => {
      const job = await queue.getJob(event.jobId);
      const jobLabels = {
        [LABEL_NAMES.JOB_NAME]: job.name,
        ...labels,
      };
      this.jobs_delayed.inc(jobLabels, 1);
    });
    queueEvents.on('completed', async (event) => {
      const job = await queue.getJob(event.jobId);
      const jobLabels = {
        [LABEL_NAMES.JOB_NAME]: job.name,
        ...labels,
      };
      this.jobs_completed.inc(jobLabels, 1);
      this.recordJobMetrics(labels, STATUS_TYPES.COMPLETED, job);
    });

    const metricInterval = setInterval(async () => {
      const { completed, failed, delayed, active, waiting } =
        await queue.getJobCounts(
          'completed',
          'failed',
          'delayed',
          'active',
          'waiting',
        );

      this.jobs_completed_total.set(labels, completed);
      this.jobs_failed_total.set(labels, failed);
      this.jobs_delayed_total.set(labels, delayed);
      this.jobs_active_total.set(labels, active);
      this.jobs_waiting_total.set(labels, waiting);
    }, this.configService.config.BULL_COLLECT_QUEUE_METRICS_INTERVAL_MS);

    return {
      remove: () => {
        clearInterval(metricInterval);
        this.job_attempts.remove(labels);
        this.job_duration.remove(labels);
        this.job_wait_duration.remove(labels);
        this.jobs_active.remove(labels);
        this.jobs_completed.remove(labels);
        this.jobs_delayed.remove(labels);
        this.jobs_failed.remove(labels);
        this.jobs_stalled.remove(labels);
        this.jobs_waiting.remove(labels);
      },
    };
  }
}
