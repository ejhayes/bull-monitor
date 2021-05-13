import { ModuleMetadata, Type } from '@nestjs/common/interfaces';
import { LoggerModuleOptions } from './logger-options.interface';

export interface LoggerModuleAsyncOptions
  extends Pick<ModuleMetadata, 'imports'> {
  inject?: Type<unknown>[];
  useClass?: Type<unknown>;
  useExisting?: Type<unknown>;
  useFactory?: (
    ...args: unknown[]
  ) => Promise<LoggerModuleOptions> | LoggerModuleOptions;
}
