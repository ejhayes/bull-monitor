import { Test } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthModule } from './health.module';

describe(HealthModule, () => {
    let healthController: HealthController;

    beforeEach(async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [HealthModule]
        }).compile()

        healthController = moduleRef.get<HealthController>(HealthController);
    })

    it('returns healthy status', async () => {
        expect(healthController.healthy()).toBe('OK')
    })
})