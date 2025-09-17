import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PluginsController } from './plugins.controller';
import { PluginsService } from './plugins.service';
import { PluginLoaderService } from './plugin-loader.service';

@Module({
  controllers: [PluginsController],
  providers: [PluginsService, PluginLoaderService],
  exports: [PluginsService],
})
export class PluginsModule implements OnModuleInit {
  constructor(
    private readonly pluginsService: PluginsService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    // Auto-load plugins if configured
    const autoEnable = this.configService.get<boolean>('plugins.autoEnable');
    if (autoEnable) {
      await this.pluginsService.autoLoadPlugins();
    }
  }
}
