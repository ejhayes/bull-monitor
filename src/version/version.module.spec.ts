import { Test } from '@nestjs/testing';
import { VersionController } from './version.controller';
import { VersionModule } from './version.module';

const EXPECTED_VERSION = 'test';

describe(VersionModule, () => {
  let versionController: VersionController;

  beforeEach(async () => {
    process.env.VERSION = EXPECTED_VERSION;

    const moduleRef = await Test.createTestingModule({
      imports: [VersionModule],
    }).compile();

    versionController = moduleRef.get<VersionController>(VersionController);
  });

  it('returns expected version', async () => {
    expect(versionController.getVersion()).toBe(EXPECTED_VERSION);
  });
});
