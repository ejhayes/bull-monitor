import { Inject } from '@nestjs/common';
import { MetricsService } from '../metrics.service';

export function InjectMetrics(): ParameterDecorator {
  return Inject(MetricsService);
}
