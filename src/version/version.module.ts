import { ConfigModule } from '@app/config/config.module';
import { Module } from '@nestjs/common';
import { VersionController } from './version.controller';

@Module({
  imports: [ConfigModule],
  controllers: [VersionController],
})
export class VersionModule {}
