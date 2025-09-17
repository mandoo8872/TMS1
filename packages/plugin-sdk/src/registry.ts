import { EventEmitter } from 'eventemitter3';
import { PluginInstance, PluginManifest, PluginStatus } from './types';

/**
 * Plugin registry for managing plugin lifecycle
 */
export class PluginRegistry extends EventEmitter {
  private plugins: Map<string, PluginInstance> = new Map();
  
  /**
   * Register a new plugin
   */
  async register(manifest: PluginManifest): Promise<void> {
    if (this.plugins.has(manifest.id)) {
      throw new Error(`Plugin ${manifest.id} is already registered`);
    }
    
    const instance: PluginInstance = {
      manifest,
      status: PluginStatus.INSTALLED,
      installedAt: new Date()
    };
    
    this.plugins.set(manifest.id, instance);
    this.emit('plugin:registered', instance);
  }
  
  /**
   * Enable a plugin
   */
  async enable(pluginId: string, config?: Record<string, any>): Promise<void> {
    const instance = this.getPlugin(pluginId);
    
    if (instance.status === PluginStatus.ENABLED) {
      throw new Error(`Plugin ${pluginId} is already enabled`);
    }
    
    try {
      // Validate config against schema if provided
      if (instance.manifest.configuration && config) {
        this.validateConfig(instance.manifest.configuration, config);
      }
      
      instance.config = config;
      instance.status = PluginStatus.ENABLED;
      instance.enabledAt = new Date();
      delete instance.error;
      
      this.emit('plugin:enabled', instance);
    } catch (error) {
      instance.status = PluginStatus.ERROR;
      instance.error = error instanceof Error ? error.message : 'Unknown error';
      throw error;
    }
  }
  
  /**
   * Disable a plugin
   */
  async disable(pluginId: string): Promise<void> {
    const instance = this.getPlugin(pluginId);
    
    if (instance.status !== PluginStatus.ENABLED) {
      throw new Error(`Plugin ${pluginId} is not enabled`);
    }
    
    instance.status = PluginStatus.DISABLED;
    instance.disabledAt = new Date();
    
    this.emit('plugin:disabled', instance);
  }
  
  /**
   * Unregister a plugin
   */
  async unregister(pluginId: string): Promise<void> {
    const instance = this.getPlugin(pluginId);
    
    if (instance.status === PluginStatus.ENABLED) {
      await this.disable(pluginId);
    }
    
    this.plugins.delete(pluginId);
    this.emit('plugin:unregistered', instance);
  }
  
  /**
   * Get plugin instance
   */
  getPlugin(pluginId: string): PluginInstance {
    const instance = this.plugins.get(pluginId);
    if (!instance) {
      throw new Error(`Plugin ${pluginId} not found`);
    }
    return instance;
  }
  
  /**
   * Get all plugins
   */
  getAllPlugins(): PluginInstance[] {
    return Array.from(this.plugins.values());
  }
  
  /**
   * Get enabled plugins
   */
  getEnabledPlugins(): PluginInstance[] {
    return this.getAllPlugins().filter(p => p.status === PluginStatus.ENABLED);
  }
  
  /**
   * Check if plugin is registered
   */
  hasPlugin(pluginId: string): boolean {
    return this.plugins.has(pluginId);
  }
  
  /**
   * Check if plugin is enabled
   */
  isEnabled(pluginId: string): boolean {
    try {
      const instance = this.getPlugin(pluginId);
      return instance.status === PluginStatus.ENABLED;
    } catch {
      return false;
    }
  }
  
  /**
   * Update plugin configuration
   */
  async updateConfig(pluginId: string, config: Record<string, any>): Promise<void> {
    const instance = this.getPlugin(pluginId);
    
    if (instance.status !== PluginStatus.ENABLED) {
      throw new Error(`Plugin ${pluginId} must be enabled to update config`);
    }
    
    if (instance.manifest.configuration) {
      this.validateConfig(instance.manifest.configuration, config);
    }
    
    instance.config = { ...instance.config, ...config };
    this.emit('plugin:config-updated', instance);
  }
  
  /**
   * Validate configuration against schema
   */
  private validateConfig(schema: any, config: Record<string, any>): void {
    // Simple validation - can be enhanced with ajv
    const required = schema.required || [];
    for (const field of required) {
      if (!(field in config)) {
        throw new Error(`Required field '${field}' is missing`);
      }
    }
    
    for (const [key, value] of Object.entries(config)) {
      const prop = schema.properties[key];
      if (!prop) continue;
      
      // Type validation
      const valueType = Array.isArray(value) ? 'array' : typeof value;
      if (prop.type && prop.type !== valueType) {
        throw new Error(`Field '${key}' must be of type ${prop.type}`);
      }
      
      // Enum validation
      if (prop.enum && !prop.enum.includes(value)) {
        throw new Error(`Field '${key}' must be one of: ${prop.enum.join(', ')}`);
      }
      
      // Number range validation
      if (prop.type === 'number') {
        if (prop.minimum !== undefined && value < prop.minimum) {
          throw new Error(`Field '${key}' must be >= ${prop.minimum}`);
        }
        if (prop.maximum !== undefined && value > prop.maximum) {
          throw new Error(`Field '${key}' must be <= ${prop.maximum}`);
        }
      }
      
      // Pattern validation
      if (prop.pattern && typeof value === 'string') {
        const regex = new RegExp(prop.pattern);
        if (!regex.test(value)) {
          throw new Error(`Field '${key}' does not match pattern ${prop.pattern}`);
        }
      }
    }
  }
}
