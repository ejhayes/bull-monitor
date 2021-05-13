import { Inject } from '@nestjs/common';
import { LoggerModule } from '../logger.module';
import { getLoggerToken } from './logger.utils';

export function InjectLogger(token: { name: string }): ParameterDecorator {
  if (!LoggerModule.loggerPrefixes.includes(token.name)) {
    LoggerModule.loggerPrefixes.push(token.name);
  }
  return Inject(getLoggerToken(token.name));
}
