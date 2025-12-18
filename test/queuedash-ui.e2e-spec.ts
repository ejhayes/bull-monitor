import { AppModule } from '@app/app.module';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

describe('Queuedash UI', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.UI = 'queuedash';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/queues', () => {
    return request(app.getHttpServer()).get('/queues/')
      .expect(200).expect(res => {
        expect(res.text).toContain('QueueDash');
      });
  });
});
