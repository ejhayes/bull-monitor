import { Provider } from '@nestjs/common';
import { getLoggerToken } from './common/logger.utils';
import { LoggerService } from './logger.service';

function createLoggerProvider(prefix: string): Provider<LoggerService> {
  return {
    inject: [LoggerService],
    provide: getLoggerToken(prefix),
    useFactory: (logger) => {
      if (prefix) {
        logger.setContext(prefix);
      }
      return logger;
    },
  };
}

export function createLoggerProviders(
  prefixes: string[],
): Array<Provider<LoggerService>> {
  return prefixes.map((prefix) => createLoggerProvider(prefix));
}
