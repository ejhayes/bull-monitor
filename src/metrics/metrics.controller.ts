import { Controller, Get, Header, Inject } from '@nestjs/common';
import { collectDefaultMetrics, register } from 'prom-client';
import { METRICS_MODULE_OPTIONS } from './common';
import { MetricsModuleOptions } from './interfaces';

@Controller('metrics')
export class MetricsController {
  constructor(@Inject(METRICS_MODULE_OPTIONS) options: MetricsModuleOptions) {
    if (options.collectDefaultMetrics) {
      collectDefaultMetrics({
        eventLoopMonitoringPrecision: options.collectMetricsEveryNMilliseconds,
      });
    }
  }

  @Get()
  @Header('content-type', register.contentType)
  async getMetrics(): Promise<string> {
    return register.metrics();
  }
}
