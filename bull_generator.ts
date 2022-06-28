import { faker } from '@faker-js/faker';
import * as Bull from 'bullmq';
import { cleanEnv, num, port, str } from 'envalid';

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

const log = (msg: string) => {
  console.log(`[${new Date()}] [${config.PREFIX}:${config.QUEUE}] ${msg}`);
};

const main = async () => {
  log('Creating queue');
  const queue = new Bull.Queue(config.QUEUE, {
    prefix: config.PREFIX,
    connection: {
      host: config.REDIS_HOST,
      port: config.REDIS_PORT,
      password: config.REDIS_PASSWORD,
    },
  });

  const scheduler = new Bull.QueueScheduler(config.QUEUE, {
    prefix: config.PREFIX,
    connection: {
      host: config.REDIS_HOST,
      port: config.REDIS_PORT,
      password: config.REDIS_PASSWORD,
    },
  });

  if (
    config.ACTION === ACTIONS.PROCESS ||
    config.ACTION === ACTIONS.CREATEPROCESS
  ) {
    log(
      `Enabling processing (${config.LIMITER_MAX} jobs per ${config.LIMITER_DURATION_MS}ms)`,
    );
    new Bull.Worker(
      config.QUEUE,
      async (job) => {
        const delay = Math.floor(Math.random() * config.MAX_JOB_DELAY_MS);
        log(`[JOB: ${job.id}] Starting job with delay ${delay}`);
        await job.log(`[JOB: ${job.id}] Starting job with delay ${delay}`);
        await sleep(delay);
        const fail = Math.round(Math.random()) === 1;

        if (fail) {
          log(`[JOB: ${job.id}] Job set to fail`);
          await job.log(`[JOB: ${job.id}] Job set to fail`);
          throw new Error(`[JOB: ${job.id}] Failing job for random reason`);
        }

        log(`[JOB: ${job.id}] Job is now complete after the delay`);
        job.log(`[JOB: ${job.id}] Job is now complete after the delay`);
      },
      {
        connection: {
          host: config.REDIS_HOST,
          port: config.REDIS_PORT,
          password: config.REDIS_PASSWORD,
        },
        limiter: {
          duration: config.LIMITER_DURATION_MS,
          max: config.LIMITER_MAX,
        },
        concurrency: config.CONCURRENCY,
      },
    );
  }

  if (
    config.ACTION === ACTIONS.CREATE ||
    config.ACTION === ACTIONS.CREATEPROCESS
  ) {
    log(`Creating jobs every ${config.CREATE_DELAY_MS}ms...`);
    setInterval(() => {
      log('Adding dummy job');
      queue.add(
        faker.commerce.product(),
        {
          buzzword: faker.company.bsBuzz(),
          job: faker.name.jobTitle(),
          name: faker.name.firstName,
        },
        { attempts: config.MAX_JOB_ATTEMPTS },
      );
    }, config.CREATE_DELAY_MS);
  }

  if (config.ACTION === ACTIONS.REMOVE) {
    scheduler.on('error', () => {
      // do nothing
    });
    log(`Removing queue`);
    await scheduler.disconnect();
    await queue.obliterate({ force: true });
    process.exit();
  }
};

main();
