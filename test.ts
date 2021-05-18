import Bull from 'bull'
import {bool, cleanEnv, num, port, str} from 'envalid'
import Faker from 'faker'

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve,ms)
    })
}

enum ACTIONS {
    PROCESS = 'process',
    REMOVE = 'remove',
    CREATE = 'create'
}

const config = cleanEnv(process.env, {
    QUEUE: str({default: 'dummy_test'}),
    ACTION: str({default: ACTIONS.PROCESS, choices: [ACTIONS.PROCESS, ACTIONS.REMOVE, ACTIONS.CREATE]}),
    DELAY_MS: num({default: 0}),
    PREFIX: str({default: 'bull'}),
    MAX_JOBS: num({default: 10}),
    REDIS_HOST: str({default: '127.0.0.1'}),
    REDIS_PORT: port({default: 6001}),
    CREATE_DELAY_MS: num({default: 0})
})

const main = async () => {
    console.log(`Using queue: ${config.PREFIX}:${config.QUEUE} (max jobs=${config.MAX_JOBS})`);
    const queue = new Bull(config.QUEUE, {
        prefix: config.PREFIX,
        //limiter: {
        //    duration: 10000,
        //    max: config.MAX_JOBS
        //},
        redis: {
            host: config.REDIS_HOST,
            port: config.REDIS_PORT
        }
    });

    await queue.isReady()

    if (config.ACTION === ACTIONS.PROCESS) {
        console.log('Enabling processing');
        queue.process(30, async (job) => {
            const delay = Math.floor(Math.random() * config.DELAY_MS)
            console.log(`Starting job: ${job.id} with delay ${delay}`);
            job.log(`Starting job: ${job.id} with delay ${delay}`);
            await sleep(delay);
            const fail = Math.round(Math.random()) === 1
            
            if (fail) {
                console.log(`Job ${job.id} marked to fail`);
                job.log(`Job ${job.id} marked to fail`);
                throw new Error(`Failing job ${job.id} for random reason`)
            }
            
            console.log(`Job ${job.id} is now complete after the delay`);
            job.log(`Job ${job.id} is now complete after the delay`);
        })
    }

    if (config.ACTION === ACTIONS.CREATE && config.CREATE_DELAY_MS > 0) {
        console.log(`Creating jobs every ${config.CREATE_DELAY_MS}ms...`)
        setInterval(() => {
            console.log('Adding dummy job')
            queue.add({
                buzzword: Faker.company.bsBuzz(),
                job: Faker.name.jobTitle(),
                name: Faker.name.firstName
            }, {attempts: 4})
        }, config.CREATE_DELAY_MS);   
    }

    if (config.ACTION === ACTIONS.REMOVE) {
        console.log(`Removing queue ${config.QUEUE}`);
        await queue.obliterate()
    }

}

main()