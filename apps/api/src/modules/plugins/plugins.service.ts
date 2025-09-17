import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/database/prisma.service';
import { PluginRuntimeService } from '@/kernel/services/plugin-runtime.service';
import { 
  PluginRegistry,
  PluginInstance,
  PluginManifest,
  PluginStatus,
} from '@tms/plugin-sdk';
import { PluginLoaderService } from './plugin-loader.service';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class PluginsService {
  private readonly logger = new Logger(PluginsService.name);
  private readonly registry = new PluginRegistry();

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly runtime: PluginRuntimeService,
    private readonly loader: PluginLoaderService,
  ) {
    // Set up registry event listeners
    this.setupRegistryListeners();
  }

  /**
   * Register a new plugin
   */
  async register(pluginPath: string): Promise<PluginInstance> {
    // Load and validate manifest
    const manifest = await this.loader.loadManifest(pluginPath);
    
    // Check if already registered
    const existing = await this.prisma.plugin.findUnique({
      where: { pluginId: manifest.id },
    });

    if (existing) {
      throw new BadRequestException(`Plugin ${manifest.id} is already registered`);
    }

    // Save to database
    await this.prisma.plugin.create({
      data: {
        pluginId: manifest.id,
        name: manifest.name,
        version: manifest.version,
        status: PluginStatus.INSTALLED,
        manifest: manifest as any,
      },
    });

    // Register in memory
    await this.registry.register(manifest);

    const instance = this.registry.getPlugin(manifest.id);
    this.logger.log(`Plugin ${manifest.id} registered successfully`);
    
    return instance;
  }

  /**
   * Enable a plugin
   */
  async enable(pluginId: string, config?: Record<string, any>): Promise<PluginInstance> {
    // Get plugin from database
    const plugin = await this.prisma.plugin.findUnique({
      where: { pluginId },
    });

    if (!plugin) {
      throw new NotFoundException(`Plugin ${pluginId} not found`);
    }

    // Enable in registry
    await this.registry.enable(pluginId, config);

    // Load into runtime
    const instance = this.registry.getPlugin(pluginId);
    await this.runtime.loadPlugin(instance);
    await this.runtime.enablePlugin(pluginId);

    // Update database
    await this.prisma.plugin.update({
      where: { pluginId },
      data: {
        status: PluginStatus.ENABLED,
        config: config as any,
        enabledAt: new Date(),
      },
    });

    this.logger.log(`Plugin ${pluginId} enabled`);
    return instance;
  }

  /**
   * Disable a plugin
   */
  async disable(pluginId: string): Promise<PluginInstance> {
    // Disable in runtime
    await this.runtime.disablePlugin(pluginId);

    // Disable in registry
    await this.registry.disable(pluginId);

    // Update database
    await this.prisma.plugin.update({
      where: { pluginId },
      data: {
        status: PluginStatus.DISABLED,
        disabledAt: new Date(),
      },
    });

    const instance = this.registry.getPlugin(pluginId);
    this.logger.log(`Plugin ${pluginId} disabled`);
    
    return instance;
  }

  /**
   * Unregister a plugin
   */
  async unregister(pluginId: string): Promise<void> {
    // Unload from runtime
    await this.runtime.unloadPlugin(pluginId);

    // Unregister from registry
    await this.registry.unregister(pluginId);

    // Delete from database
    await this.prisma.plugin.delete({
      where: { pluginId },
    });

    this.logger.log(`Plugin ${pluginId} unregistered`);
  }

  /**
   * Upgrade a plugin
   */
  async upgrade(pluginId: string, newPluginPath: string): Promise<PluginInstance> {
    // Load new manifest
    const newManifest = await this.loader.loadManifest(newPluginPath);

    if (newManifest.id !== pluginId) {
      throw new BadRequestException('Plugin ID mismatch');
    }

    // Get current plugin
    const currentPlugin = await this.prisma.plugin.findUnique({
      where: { pluginId },
    });

    if (!currentPlugin) {
      throw new NotFoundException(`Plugin ${pluginId} not found`);
    }

    const currentVersion = currentPlugin.version;
    const newVersion = newManifest.version;

    // Validate version upgrade
    if (!this.isVersionUpgrade(currentVersion, newVersion)) {
      throw new BadRequestException(
        `Invalid version upgrade from ${currentVersion} to ${newVersion}`
      );
    }

    // Disable if enabled
    const wasEnabled = currentPlugin.status === PluginStatus.ENABLED;
    if (wasEnabled) {
      await this.disable(pluginId);
    }

    // Update plugin files
    await this.loader.updatePluginFiles(pluginId, newPluginPath);

    // Update database
    await this.prisma.plugin.update({
      where: { pluginId },
      data: {
        version: newVersion,
        manifest: newManifest as any,
      },
    });

    // Re-enable if was enabled
    if (wasEnabled) {
      await this.enable(pluginId, currentPlugin.config as any);
    }

    const instance = this.registry.getPlugin(pluginId);
    this.logger.log(`Plugin ${pluginId} upgraded from ${currentVersion} to ${newVersion}`);
    
    return instance;
  }

  /**
   * Get all plugins
   */
  async getAllPlugins(): Promise<PluginInstance[]> {
    const plugins = await this.prisma.plugin.findMany({
      orderBy: { installedAt: 'desc' },
    });

    // Sync with registry
    for (const plugin of plugins) {
      if (!this.registry.hasPlugin(plugin.pluginId)) {
        await this.registry.register(plugin.manifest as PluginManifest);
        
        if (plugin.status === PluginStatus.ENABLED) {
          await this.registry.enable(plugin.pluginId, plugin.config as any);
        }
      }
    }

    return this.registry.getAllPlugins();
  }

  /**
   * Get plugin by ID
   */
  async getPlugin(pluginId: string): Promise<PluginInstance> {
    const plugin = await this.prisma.plugin.findUnique({
      where: { pluginId },
    });

    if (!plugin) {
      throw new NotFoundException(`Plugin ${pluginId} not found`);
    }

    if (!this.registry.hasPlugin(pluginId)) {
      await this.registry.register(plugin.manifest as PluginManifest);
    }

    return this.registry.getPlugin(pluginId);
  }

  /**
   * Update plugin configuration
   */
  async updateConfig(
    pluginId: string,
    config: Record<string, any>,
  ): Promise<PluginInstance> {
    // Update in registry
    await this.registry.updateConfig(pluginId, config);

    // Update in database
    await this.prisma.plugin.update({
      where: { pluginId },
      data: { config: config as any },
    });

    // Reload plugin if enabled
    if (this.registry.isEnabled(pluginId)) {
      await this.runtime.disablePlugin(pluginId);
      await this.runtime.enablePlugin(pluginId);
    }

    return this.registry.getPlugin(pluginId);
  }

  /**
   * Auto-load plugins from directory
   */
  async autoLoadPlugins(): Promise<void> {
    const pluginDir = this.configService.get<string>('plugins.directory');
    if (!pluginDir) return;

    try {
      const entries = await fs.readdir(pluginDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const pluginPath = path.join(pluginDir, entry.name);
          
          try {
            // Check if manifest exists
            const manifestPath = path.join(pluginPath, 'plugin.json');
            await fs.access(manifestPath);
            
            // Register plugin if not already registered
            const manifest = await this.loader.loadManifest(pluginPath);
            
            const existing = await this.prisma.plugin.findUnique({
              where: { pluginId: manifest.id },
            });
            
            if (!existing) {
              await this.register(pluginPath);
              this.logger.log(`Auto-registered plugin: ${manifest.id}`);
              
              // Auto-enable if configured
              if (this.configService.get<boolean>('plugins.autoEnable')) {
                await this.enable(manifest.id);
                this.logger.log(`Auto-enabled plugin: ${manifest.id}`);
              }
            } else if (existing.status === PluginStatus.ENABLED) {
              // Re-enable already enabled plugins
              await this.enable(existing.pluginId, existing.config as any);
            }
          } catch (error) {
            this.logger.warn(`Failed to load plugin from ${pluginPath}:`, error);
          }
        }
      }
    } catch (error) {
      this.logger.error('Failed to auto-load plugins:', error);
    }
  }

  /**
   * Set up registry event listeners
   */
  private setupRegistryListeners(): void {
    this.registry.on('plugin:registered', (instance: PluginInstance) => {
      this.logger.debug(`Plugin registered: ${instance.manifest.id}`);
    });

    this.registry.on('plugin:enabled', (instance: PluginInstance) => {
      this.logger.debug(`Plugin enabled: ${instance.manifest.id}`);
    });

    this.registry.on('plugin:disabled', (instance: PluginInstance) => {
      this.logger.debug(`Plugin disabled: ${instance.manifest.id}`);
    });

    this.registry.on('plugin:unregistered', (instance: PluginInstance) => {
      this.logger.debug(`Plugin unregistered: ${instance.manifest.id}`);
    });
  }

  /**
   * Check if version is an upgrade
   */
  private isVersionUpgrade(current: string, next: string): boolean {
    // Simple semantic version comparison
    const currentParts = current.split('.').map(Number);
    const nextParts = next.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
      const currentPart = currentParts[i] || 0;
      const nextPart = nextParts[i] || 0;
      
      if (nextPart > currentPart) return true;
      if (nextPart < currentPart) return false;
    }

    return false;
  }
}
