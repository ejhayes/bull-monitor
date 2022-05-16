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
  PROCESS = 'process',
  REMOVE = 'remove',
}

const config = cleanEnv(process.env, {
  QUEUE: str({ default: 'dummy_test' }),
  ACTION: str({
    default: ACTIONS.PROCESS,
    choices: [ACTIONS.PROCESS, ACTIONS.REMOVE, ACTIONS.CREATE],
  }),
  DELAY_MS: num({ default: 0 }),
  PREFIX: str({ default: 'bull' }),
  MAX_JOBS: num({ default: 10 }),
  REDIS_HOST: str({ default: '127.0.0.1' }),
  REDIS_PORT: port({ default: 6001 }),
  CREATE_DELAY_MS: num({ default: 0 }),
});

const main = async () => {
  console.log(
    `Using queue: ${config.PREFIX}:${config.QUEUE} (max jobs=${config.MAX_JOBS})`,
  );
  const queue = new Bull.Queue(config.QUEUE, {
    prefix: config.PREFIX,
    //limiter: {
    //    duration: 10000,
    //    max: config.MAX_JOBS
    //},
    connection: {
      host: config.REDIS_HOST,
      port: config.REDIS_PORT,
    },
  });

  //await queue.isReady()

  if (config.ACTION === ACTIONS.PROCESS) {
    console.log('Enabling processing');
    new Bull.Worker(
      config.QUEUE,
      async (job) => {
        const delay = Math.floor(Math.random() * config.DELAY_MS);
        console.log(`Starting job: ${job.id} with delay ${delay}`);
        await job.log(`Starting job: ${job.id} with delay ${delay}`);
        await sleep(delay);
        const fail = Math.round(Math.random()) === 1;

        if (fail) {
          console.log(`Job ${job.id} marked to fail`);
          await job.log(`Job ${job.id} marked to fail`);
          throw new Error(`Failing job ${job.id} for random reason`);
        }

        console.log(`Job ${job.id} is now complete after the delay`);
        job.log(`Job ${job.id} is now complete after the delay`);
      },
      {
        connection: {
          host: config.REDIS_HOST,
          port: config.REDIS_PORT,
        },
      },
    );
  }

  if (config.ACTION === ACTIONS.CREATE && config.CREATE_DELAY_MS > 0) {
    console.log(`Creating jobs every ${config.CREATE_DELAY_MS}ms...`);
    setInterval(() => {
      console.log('Adding dummy job');
      queue.add(
        'asdasd',
        {
          buzzword: faker.company.bsBuzz(),
          job: faker.name.jobTitle(),
          name: faker.name.firstName,
        },
        { attempts: 4 },
      );
    }, config.CREATE_DELAY_MS);
  }

  if (config.ACTION === ACTIONS.REMOVE) {
    console.log(`Removing queue ${config.QUEUE}`);
    await queue.obliterate();
  }
};

main();
