import { Module } from '@nestjs/common';
import { ConfigModule } from '@app/config/config.module';
import { VersionController } from './version.controller';

@Module({
  imports: [ConfigModule],
  controllers: [VersionController],
})
export class VersionModule {}
