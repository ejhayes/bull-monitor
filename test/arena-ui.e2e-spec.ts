import { AppModule } from '@app/app.module';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

jest.mock('ioredis', () => require('ioredis-mock/jest'));

describe('Arena UI', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.UI = 'arena';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/queues', () => {
    return request(app.getHttpServer()).get('/queues/').expect(200);
    //.expect('something')
  });
});
