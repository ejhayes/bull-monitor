import { DynamicModule, Module, Provider } from '@nestjs/common';
import { MetricsModuleAsyncOptions, MetricsModuleOptions } from './interfaces';
import { METRICS_MODULE_OPTIONS } from './common';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

@Module({
  controllers: [MetricsController],
})
export class MetricsModule {
  static forRoot(options: MetricsModuleOptions): DynamicModule {
    const metricsOptionProvider: Provider = {
      provide: METRICS_MODULE_OPTIONS,
      useValue: options,
    };

    return {
      exports: [MetricsService],
      global: true,
      module: MetricsModule,
      providers: [metricsOptionProvider, MetricsService],
    };
  }

  static forRootAsync(options: MetricsModuleAsyncOptions): DynamicModule {
    const metricsOptionProvider: Provider =
      this.createAsyncOptionsProvider(options);

    return {
      exports: [MetricsService],
      global: true,
      imports: options.imports,
      module: MetricsModule,
      providers: [metricsOptionProvider, MetricsService],
    };
  }

  private static createAsyncOptionsProvider(
    options: MetricsModuleAsyncOptions,
  ): Provider {
    if (options.useFactory) {
      return {
        inject: options.inject || [],
        provide: METRICS_MODULE_OPTIONS,
        useFactory: options.useFactory,
      };
    }

    return {
      inject: [options.useClass || options.useExisting],
      provide: METRICS_MODULE_OPTIONS,
      useFactory: (optionsFactory: MetricsModuleAsyncOptions) => optionsFactory,
    };
  }
}
