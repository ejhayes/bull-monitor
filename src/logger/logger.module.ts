import { DynamicModule, Module, Provider } from '@nestjs/common';
import { LoggerModuleAsyncOptions, LoggerModuleOptions } from './interfaces';
import { LOGGER_MODULE_OPTIONS } from './common';
import { LoggerService } from './logger.service';
import { createLoggerProviders } from './logger.providers';

@Module({})
export class LoggerModule {
  public static loggerPrefixes: string[] = [];
  private static module: DynamicModule = {
    exports: [],
    global: true,
    imports: [],
    module: LoggerModule,
    providers: [LoggerService],
  };

  public static forFeature(
    dynamicLoggerProviderPrefixes: string[] = [],
  ): DynamicModule {
    const prefixedLoggerProviders: Provider[] = createLoggerProviders(
      dynamicLoggerProviderPrefixes,
    );
    this.module.providers = this.module.providers.concat(
      prefixedLoggerProviders,
    );
    this.module.exports = this.module.exports.concat(prefixedLoggerProviders);

    return this.module;
  }

  public static forRoot(
    options: LoggerModuleOptions,
    dynamicLoggerProviderPrefixes: string[] = [],
  ): DynamicModule {
    const loggerPrefixes = this.loggerPrefixes.concat(
      dynamicLoggerProviderPrefixes,
    );
    const prefixedLoggerProviders: Provider[] =
      createLoggerProviders(loggerPrefixes);
    const loggerOptionProvider: Provider = {
      provide: LOGGER_MODULE_OPTIONS,
      useValue: options,
    };

    this.module.providers = this.module.providers.concat(
      [loggerOptionProvider],
      prefixedLoggerProviders,
    );
    this.module.exports = this.module.exports.concat(prefixedLoggerProviders);

    return this.module;
  }

  public static forRootAsync(
    options: LoggerModuleAsyncOptions,
    dynamicLoggerProviderPrefixes: string[] = [],
  ): DynamicModule {
    const loggerPrefixes = this.loggerPrefixes.concat(
      dynamicLoggerProviderPrefixes,
    );
    const prefixedLoggerProviders: Provider[] =
      createLoggerProviders(loggerPrefixes);
    const loggerOptionProvider: Provider =
      this.createAsyncOptionsProvider(options);

    this.module.imports = this.module.imports.concat(options.imports);
    this.module.providers = this.module.providers.concat(
      [loggerOptionProvider],
      prefixedLoggerProviders,
    );
    this.module.exports = this.module.exports.concat(prefixedLoggerProviders);

    return this.module;
  }

  private static createAsyncOptionsProvider(
    options: LoggerModuleAsyncOptions,
  ): Provider {
    if (options.useFactory) {
      return {
        inject: options.inject || [],
        provide: LOGGER_MODULE_OPTIONS,
        useFactory: options.useFactory,
      };
    }

    return {
      inject: [options.useClass || options.useExisting],
      provide: LOGGER_MODULE_OPTIONS,
      useFactory: (optionsFactory: LoggerModuleAsyncOptions) => optionsFactory,
    };
  }
}
