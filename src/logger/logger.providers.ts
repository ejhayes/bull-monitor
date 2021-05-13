import { LoggerService } from './logger.service';
import { Provider } from '@nestjs/common';
import { getLoggerToken } from './common/logger.utils';

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
