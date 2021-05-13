import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '../config/config.service';

@Controller('version')
export class VersionController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  getVersion() {
    return this.configService.config.VERSION;
  }
}
