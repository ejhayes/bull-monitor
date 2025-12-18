import { faker } from '@faker-js/faker';
import * as Bull from 'bullmq';
import { Command } from '@commander-js/extra-typings';
import {createLogger, transports, format} from 'winston';

const parseBool = (v: string) => toBool(v);
const parseNumber = (v: string) => toNumber(v);

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

// TODO: refactor this so it uses regular arguments

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

enum ACTIONS {
  CREATE = 'create',
  CREATEPROCESS = 'createprocess',
  PROCESS = 'process',
  REMOVE = 'remove',
}

/*
const config = cleanEnv(process.env, {
  QUEUE: str({ default: 'dummy_test' }),
  ACTION: str({
    default: ACTIONS.PROCESS,
    choices: [
      ACTIONS.PROCESS,
      ACTIONS.REMOVE,
      ACTIONS.CREATE,
      ACTIONS.CREATEPROCESS,
    ],
  }),
  MAX_JOB_DELAY_MS: num({ default: 100 }),
  MAX_JOB_ATTEMPTS: num({ default: 4 }),
  PREFIX: str({ default: 'bull' }),
  LIMITER_MAX: num({ default: 10 }),
  LIMITER_DURATION_MS: num({ default: 1000 }),
  REDIS_HOST: str({ default: '127.0.0.1' }),
  REDIS_PASSWORD: str({ default: '' }),
  REDIS_PORT: port({ default: 6001 }),
  CREATE_DELAY_MS: num({ default: 0 }),
  CONCURRENCY: num({ default: 1 }),
});
*/

const program = new Command()
  .name('bull-generator')
  .version('1.0.0')
  .description('Generates jobs in a Bull queue for testing purposes')
  .argument('[queue]', 'Name of the queue', 'dummyQueue')
  .option('-F, --fail-probability <probability>','probability of job failure (0.0 - 1.0)', parseNumber, 0.3)
  .option('-c, --concurrency <concurrency>','concurrency', toNumber, 1)
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
  .option('-J, --create-job-delay <delay>','delay job creation (mx)', parseNumber, 100)
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

      setInterval(() => {
        const jobData = {
          buzzword: faker.company.buzzPhrase(),
          job: faker.person.jobTitle(),
          name: faker.person.fullName(),
        };

        log.info(`Adding job to queue ${queueName}: ${JSON.stringify(jobData)}`);
        queue.add(faker.commerce.product(), jobData);
      }, options.createJobDelay);
    }

    // do processing last
    if (options.processJobs) {
      log.info(`Enabling processing of jobs in ${queueName}...`);
      configureWorker(queueName, options);
    }
  });

//const options = program.opts()

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
    log.error(`[JOB: ${job?.id}] Failed with error: ${err.message}`);
  })
  .on('completed', (job) => {
    log.info(`[JOB: ${job?.id}] Completed successfully`);
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

