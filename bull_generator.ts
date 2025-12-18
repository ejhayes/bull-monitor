import { faker } from '@faker-js/faker';
import * as Bull from 'bullmq';
import { Command } from '@commander-js/extra-typings';
import {createLogger, transports, format} from 'winston';

const log = createLogger({
  level: toBool(process.env.DEBUG) ? 'debug' : 'info',
  format: format.combine(
    format.colorize(),
    format.timestamp(),
    format.printf(
      ({ level, message, timestamp }) => {
        return `${timestamp} [${level}] ${message}`;
      }
    )
  ),
  transports: [
    new transports.Console(),
  ]
});

const parseNumber = (value: string) => toNumber(value);

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const program = new Command()
  .name('bull-generator')
  .version('1.0.0')
  .description('Generates jobs in a Bull queue for testing purposes')
  .argument('[queue]', 'Name of the queue', 'dummyQueue')
  .option('-F, --fail-probability <probability>','probability of job failure (0.0 - 1.0)', parseNumber, 0.3)
  .option('-c, --concurrency <concurrency>','concurrency', parseNumber, 1)
  .option('-E, --queue-prefix <prefix>','queue prefix', 'bull')
  .option('-l, --rate-limit <limit>','rate limit (requests/ms)', '10/1000')
  .option('-h, --redis-host <host>','redis host', '127.0.0.1')
  .option('-p, --redis-port <port>','redis port', parseNumber, 6379)
  .option('-P, --redis-password <password>','redis password')
  .option('-d, --job-duration <duration>','max job duration (ms)', parseNumber, 100)
  .option('-b, --job-backoff-duration <duration>','backoff duration (ms)', parseNumber, 0)
  .option('-a, --job-attempts <attempts>','max job attempts', parseNumber, 4)
  .option('-C, --create-jobs','create jobs', false)
  .option('-R, --process-jobs','process jobs', false)
  .option('-J, --create-job-delay <delay>','delay job creation (ms)', parseNumber, 100)
  .option('-X, --remove-queue','remove queue', false)
  .action(async (queueName, options) => {
    log.info('Using queue:', queueName);
    log.debug(`Options: ${JSON.stringify(options)}`);
    
    // remove queue first
    if (options.removeQueue) {
      log.info(`Removing queue ${queueName}...`);
      await removeQueue(queueName, options);
    }

    // create jobs second
    if (options.createJobs) {
      log.info(`Creating jobs in ${queueName} every ${options.createJobDelay}ms...`);
      const queue = configureQueue(queueName, options);
      (async () => {
        while (true) {
          await sleep(Math.floor(Math.random() * options.createJobDelay));
          log.info(`Adding job to queue ${queueName}`);
          await queue.add(faker.commerce.product(), {
            buzzword: faker.company.buzzPhrase(),
            job: faker.person.jobTitle(),
            name: faker.person.fullName(),
          });
        }
      })();
    }

    // do processing last
    if (options.processJobs) {
      log.info(`Enabling processing of jobs in ${queueName}...`);
      configureWorker(queueName, options);
    }
  });

program.parse(process.argv);


// helpers
async function removeQueue(queueName: string, options: ReturnType<typeof program.opts>) {
  const queue = configureQueue(queueName, options);

  log.info(`Removing queue ${queueName}`);
  await queue.obliterate({ force: true })
  log.info(`Queue ${queueName} removed`);
}

function configureQueue(queueName: string, options: ReturnType<typeof program.opts>) {
  return new Bull.Queue(queueName, {
    prefix: options.queuePrefix,
    connection: {
      host: options.redisHost,
      port: options.redisPort,
      password: options.redisPassword,
    },
    defaultJobOptions: {
      attempts: options.jobAttempts,
      backoff: {
        type: 'exponential',
        delay: options.jobBackoffDuration,
      }
    }
  });
}

function configureWorker(queueName: string, options: ReturnType<typeof program.opts>) {
  const [limit, durationMs] = options.rateLimit.split('/').map(v => toNumber(v));

  log.info(`Configuring worker with rate limit: ${limit} per ${durationMs}ms`);

  return new Bull.Worker(queueName,
    async (job) => {
      const delay = Math.floor(Math.random() * options.jobDuration);
      await job.log(`[JOB: ${job.id}] Starting job with delay ${delay}ms`);
      await sleep(delay);

      // random failure
      failWithProbability(options.failProbability);
      
      await job.log(`[JOB: ${job.id}] Job is now complete after the delay`);
    },
    {
      prefix: options.queuePrefix,
      connection: {
        host: options.redisHost,
        port: options.redisPort,
        password: options.redisPassword,
      },
      limiter: {
        duration: durationMs,
        max: limit,
      },
      concurrency: options.concurrency,
    },
  ).on('failed', (job, err) => {
    job?.log(`[JOB: ${job?.id}] Failed with error: ${err.message}`);
  })
  .on('active', (job) => {
    job.log(`[JOB: ${job?.id}] is now active`);
  })
  .on('drained', () => {
    log.info(`All jobs have been processed, queue is drained`);
  })
  .on('stalled', (job) => {
    log.warn(`[JOB: ${job}] has stalled and will be reprocessed`);
  })
  .on('completed', (job) => {
    job.log(`[JOB: ${job?.id}] Completed successfully`);
  });
}

function failWithProbability(probability: number): void {
  if (probability < 0 || probability > 1) {
    throw new Error('probability must be between 0 and 1');
  }

  if (Math.random() < probability) {
    throw new Error('Injected failure');
  }
}

function toNumber(
  value: unknown,
  defaultValue?: number,
): number {
  if (value === undefined || value === null) {
    if (defaultValue !== undefined) return defaultValue;
    throw new Error('Expected number but got undefined');
  }

  const n =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : NaN;

  if (!Number.isFinite(n)) {
    throw new Error(`Invalid number: ${value}`);
  }

  return n;
}

function toBool(
  value: unknown,
  defaultValue = false,
): boolean {
  if (value === undefined || value === null) return defaultValue;

  if (typeof value === 'boolean') return value;

  if (typeof value === 'string') {
    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
  }

  return defaultValue;
}