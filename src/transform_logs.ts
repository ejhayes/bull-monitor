import { LoggerService } from '@app/logger';
import { program } from 'commander';
import { Environments, LOG_LEVELS } from './logger/common';
import {} from 'stream';

const DEFAULT_CONTEXT = 'http-context';
const DEFAULT_LOG_LABEL = 'transform-logs';
const DEFAULT_LOG_LEVEL = LOG_LEVELS.INFO;
const VERSION = '1.0.0';

// https://oauth2-proxy.github.io/oauth2-proxy/docs/configuration/overview#standard-log-format
const DEFAULT_REGEX = /.+\s.+\s(?<context>.+:\d+):\s(?<message>.+$)/;

interface ITransformerOptions {
  //context: string;
  label: string;
  level: LOG_LEVELS;
  production: boolean;
  regex?: string;
}

interface IParsedMessage {
  [key: string]: string;
  context: string;
  message: string;
}

program
  .option(
    '--default-context <context>',
    'Context to use for logs',
    DEFAULT_CONTEXT,
  )
  .option('--label', 'Log label', DEFAULT_LOG_LABEL)
  .option('--level <level>', 'Log level to capture', DEFAULT_LOG_LEVEL)
  .option('--production', 'Enables production specific logging')
  .option('--regex <regex>', 'Regex to parse messages')
  .version(VERSION);

program.parse();

const opts = program.opts() as ITransformerOptions;

const logger = new LoggerService({
  env: opts.production ? Environments.PRODUCTION : Environments.DEVELOPMENT,
  label: opts.label,
  level: opts.level,
});

const regexParser = opts.regex ? new RegExp(opts.regex) : DEFAULT_REGEX;

process.stdin.on('data', (data) => {
  for (const msg of data
    .toString()
    .split('\n')
    .filter((el) => el)) {
    try {
      const parsed = msg.match(regexParser).groups as IParsedMessage;
      logger.setContext(parsed.context);
      if (parsed.message.search(/^ERROR/) >= 0) {
        logger.error(parsed.message);
      } else {
        logger.log(parsed.message);
      }
    } catch (err) {
      //logger.error(err);
      logger.setContext(DEFAULT_CONTEXT);
      logger.log(msg);
    }
  }
});
