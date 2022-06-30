import { Test } from '@nestjs/testing';
import { OpenAPIModule } from './openapi.module';

describe(OpenAPIModule, () => {
  it('works', async () => {
    await Test.createTestingModule({
      imports: [OpenAPIModule],
    }).compile();

    expect(true).toBe(true);
  });
});
