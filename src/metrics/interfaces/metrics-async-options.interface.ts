import { ModuleMetadata, Type } from '@nestjs/common/interfaces';
import { MetricsModuleOptions } from './metrics-options.interface';

export interface MetricsModuleAsyncOptions
  extends Pick<ModuleMetadata, 'imports'> {
  inject?: Type<unknown>[];
  useClass?: Type<unknown>;
  useExisting?: Type<unknown>;
  useFactory?: (
    ...args: unknown[]
  ) => Promise<MetricsModuleOptions> | MetricsModuleOptions;
}
