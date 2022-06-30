import { Test } from '@nestjs/testing';
import { METRICS_MODULE_OPTIONS } from './common';
import { MetricsController } from './metrics.controller';
import { MetricsModule } from './metrics.module';
import { MetricsService } from './metrics.service';

describe(MetricsModule, () => {
  let metricsController: MetricsController;
  let metricsService: MetricsService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [MetricsController],
      providers: [
        MetricsService,
        {
          provide: METRICS_MODULE_OPTIONS,
          useValue: {},
        },
      ],
    }).compile();

    metricsController = moduleRef.get<MetricsController>(MetricsController);
    metricsService = moduleRef.get<MetricsService>(MetricsService);
  });

  it('returns empty metrics', async () => {
    const metrics = await metricsController.getMetrics();
    expect(metrics.trim()).toBe('');
  });

  it('creates a metric', async () => {
    const counterMetric = metricsService.createCounter({
      name: 'test',
      help: 'test',
    });

    expect(counterMetric.inc).toBeDefined();
  });
});
