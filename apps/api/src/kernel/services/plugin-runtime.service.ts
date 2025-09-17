import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { 
  PluginInstance, 
  PluginApi, 
  PluginContext,
  PluginContextFactory,
  DefaultEventBus,
} from '@tms/plugin-sdk';
import { EventBusService } from './event-bus.service';
import { HookService } from './hook.service';

@Injectable()
export class PluginRuntimeService {
  private readonly logger = new Logger(PluginRuntimeService.name);
  private readonly plugins = new Map<string, PluginApi>();
  private readonly contextFactory: PluginContextFactory;

  constructor(
    private readonly configService: ConfigService,
    private readonly eventBus: EventBusService,
    private readonly hookService: HookService,
  ) {
    // Create plugin context factory with kernel services
    this.contextFactory = new PluginContextFactory({
      eventBus: {
        emit: async (event) => this.eventBus.emit(event),
        on: (type, handler) => this.eventBus.on(type, handler),
        off: (type, handler) => this.eventBus.off(type, handler),
      },
      services: new Map([
        ['eventBus', this.eventBus],
        ['hookService', this.hookService],
      ]),
    });
  }

  /**
   * Load and initialize a plugin
   */
  async loadPlugin(instance: PluginInstance): Promise<void> {
    try {
      const { manifest } = instance;
      
      // Dynamic import of plugin
      const pluginPath = `${this.configService.get('plugins.directory')}/${manifest.id}/${manifest.main}`;
      const PluginClass = await import(pluginPath);
      
      // Create plugin instance
      const plugin: PluginApi = new PluginClass.default();
      
      // Create plugin context
      const context = this.contextFactory.createContext(
        manifest.id,
        manifest.version,
        instance.config,
      );
      
      // Initialize plugin
      if ('initialize' in plugin) {
        (plugin as any).initialize(context, manifest);
      }
      
      // Install plugin
      await plugin.install(instance.config);
      
      // Register plugin
      this.plugins.set(manifest.id, plugin);
      
      // Register capabilities
      await this.registerCapabilities(manifest.id, plugin, manifest);
      
      this.logger.log(`Plugin ${manifest.id} loaded successfully`);
    } catch (error) {
      this.logger.error(`Failed to load plugin ${instance.manifest.id}`, error);
      throw error;
    }
  }

  /**
   * Enable a plugin
   */
  async enablePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not loaded`);
    }
    
    await plugin.enable();
    this.logger.log(`Plugin ${pluginId} enabled`);
  }

  /**
   * Disable a plugin
   */
  async disablePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not loaded`);
    }
    
    await plugin.disable();
    
    // Unregister hook handlers
    this.hookService.unregisterPlugin(pluginId);
    
    this.logger.log(`Plugin ${pluginId} disabled`);
  }

  /**
   * Unload a plugin
   */
  async unloadPlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      return;
    }
    
    await plugin.uninstall();
    this.plugins.delete(pluginId);
    this.hookService.unregisterPlugin(pluginId);
    
    this.logger.log(`Plugin ${pluginId} unloaded`);
  }

  /**
   * Get loaded plugin
   */
  getPlugin(pluginId: string): PluginApi | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * Register plugin capabilities
   */
  private async registerCapabilities(
    pluginId: string,
    plugin: PluginApi,
    manifest: any,
  ): Promise<void> {
    const { capabilities } = manifest;
    
    // Register event handlers
    if (capabilities.events && plugin.handleEvent) {
      for (const eventCap of capabilities.events) {
        this.eventBus.on(eventCap.eventType, async (event) => {
          // Check filter if provided
          if (eventCap.filter) {
            const matches = Object.entries(eventCap.filter).every(
              ([key, value]) => (event as any)[key] === value,
            );
            if (!matches) return;
          }
          
          await plugin.handleEvent!(event);
        });
      }
    }
    
    // Register hook handlers
    if (capabilities.hooks && plugin.handleHook) {
      for (const hookCap of capabilities.hooks) {
        this.hookService.registerHandler(
          hookCap.hookId,
          pluginId,
          async (context) => plugin.handleHook!(context),
          hookCap.order || 0,
        );
      }
    }
    
    // TODO: Register API endpoints, UI slots, workflows
  }
}
