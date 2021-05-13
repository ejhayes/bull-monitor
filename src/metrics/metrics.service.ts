import * as promClient from 'prom-client';
import { Inject, Injectable } from '@nestjs/common';
import { METRICS_MODULE_OPTIONS } from './common';
import { MetricsModuleOptions } from './interfaces';

@Injectable()
export class MetricsService {
  constructor(
    @Inject(METRICS_MODULE_OPTIONS)
    private readonly options: MetricsModuleOptions,
  ) {}

  public createCounter<T extends string = string>(
    config: promClient.CounterConfiguration<T>,
  ): promClient.Counter<T> {
    return new promClient.Counter(config);
  }

  public createGauge<T extends string = string>(
    config: promClient.GaugeConfiguration<T>,
  ): promClient.Gauge<T> {
    return new promClient.Gauge(config);
  }

  public createHistogram<T extends string>(
    config: promClient.HistogramConfiguration<T>,
  ): promClient.Histogram<T> {
    return new promClient.Histogram(config);
  }

  public createSummary<T extends string = string>(
    config: promClient.SummaryConfiguration<T>,
  ): promClient.Summary<T> {
    return new promClient.Summary(config);
  }

  public get promClient(): typeof promClient {
    return promClient;
  }
}
