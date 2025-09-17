import { 
  Controller, 
  Get, 
  Post, 
  Put,
  Delete,
  Patch,
  Param, 
  Body, 
  Query,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { PluginInstance } from '@tms/plugin-sdk';
import { PluginsService } from './plugins.service';

@ApiTags('plugins')
@Controller('plugins')
export class PluginsController {
  constructor(private readonly pluginsService: PluginsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all plugins' })
  async getAllPlugins(): Promise<PluginInstance[]> {
    return this.pluginsService.getAllPlugins();
  }

  @Get(':pluginId')
  @ApiOperation({ summary: 'Get plugin by ID' })
  async getPlugin(@Param('pluginId') pluginId: string): Promise<PluginInstance> {
    return this.pluginsService.getPlugin(pluginId);
  }

  @Post('register')
  @ApiOperation({ summary: 'Register a new plugin' })
  async register(@Body('pluginPath') pluginPath: string): Promise<PluginInstance> {
    return this.pluginsService.register(pluginPath);
  }

  @Post('upload')
  @ApiOperation({ summary: 'Upload and register a plugin' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadPlugin(@UploadedFile() file: Express.Multer.File) {
    // In a real implementation, this would:
    // 1. Save the uploaded file (zip/tar)
    // 2. Extract it to a temporary directory
    // 3. Validate the plugin structure
    // 4. Move to plugins directory
    // 5. Register the plugin
    
    return {
      message: 'Plugin upload endpoint - implementation pending',
      filename: file?.filename,
    };
  }

  @Patch(':pluginId/enable')
  @ApiOperation({ summary: 'Enable a plugin' })
  async enable(
    @Param('pluginId') pluginId: string,
    @Body() config?: Record<string, any>,
  ): Promise<PluginInstance> {
    return this.pluginsService.enable(pluginId, config);
  }

  @Patch(':pluginId/disable')
  @ApiOperation({ summary: 'Disable a plugin' })
  async disable(@Param('pluginId') pluginId: string): Promise<PluginInstance> {
    return this.pluginsService.disable(pluginId);
  }

  @Delete(':pluginId')
  @ApiOperation({ summary: 'Unregister a plugin' })
  async unregister(@Param('pluginId') pluginId: string): Promise<void> {
    return this.pluginsService.unregister(pluginId);
  }

  @Put(':pluginId/upgrade')
  @ApiOperation({ summary: 'Upgrade a plugin' })
  async upgrade(
    @Param('pluginId') pluginId: string,
    @Body('pluginPath') pluginPath: string,
  ): Promise<PluginInstance> {
    return this.pluginsService.upgrade(pluginId, pluginPath);
  }

  @Put(':pluginId/config')
  @ApiOperation({ summary: 'Update plugin configuration' })
  async updateConfig(
    @Param('pluginId') pluginId: string,
    @Body() config: Record<string, any>,
  ): Promise<PluginInstance> {
    return this.pluginsService.updateConfig(pluginId, config);
  }

  @Post('reload')
  @ApiOperation({ summary: 'Reload all plugins' })
  async reloadPlugins(): Promise<void> {
    await this.pluginsService.autoLoadPlugins();
  }
}
