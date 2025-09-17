import { CloudEvent } from '@tms/contracts';
import {
  PluginApi,
  PluginContext,
  PluginManifest,
  PluginRequest,
  PluginResponse,
  HookContext,
  HookResult,
} from './types';

/**
 * Base class for TMS plugins
 * Provides default implementations and utilities
 */
export abstract class Plugin implements PluginApi {
  protected context!: PluginContext;
  protected manifest!: PluginManifest;
  
  constructor() {}
  
  /**
   * Initialize plugin with context
   * Called by the plugin runtime
   */
  public initialize(context: PluginContext, manifest: PluginManifest): void {
    this.context = context;
    this.manifest = manifest;
  }
  
  // Lifecycle methods - override in subclasses
  async install(config?: Record<string, any>): Promise<void> {
    this.context.logger.info(`Installing plugin ${this.manifest.id}`, { config });
  }
  
  async enable(): Promise<void> {
    this.context.logger.info(`Enabling plugin ${this.manifest.id}`);
  }
  
  async disable(): Promise<void> {
    this.context.logger.info(`Disabling plugin ${this.manifest.id}`);
  }
  
  async uninstall(): Promise<void> {
    this.context.logger.info(`Uninstalling plugin ${this.manifest.id}`);
  }
  
  async upgrade(fromVersion: string): Promise<void> {
    this.context.logger.info(`Upgrading plugin ${this.manifest.id} from ${fromVersion} to ${this.manifest.version}`);
  }
  
  // Runtime methods - override as needed
  async handleRequest(_req: PluginRequest): Promise<PluginResponse> {
    return {
      status: 404,
      body: { error: 'Not implemented' }
    };
  }
  
  async handleEvent(event: CloudEvent): Promise<void> {
    this.context.logger.debug(`Received event ${event.type}`, { event });
  }
  
  async handleHook(_context: HookContext): Promise<HookResult> {
    return { continue: true };
  }
  
  // Helper methods
  protected async emitEvent(type: string, data: any, subject?: string): Promise<void> {
    const event: CloudEvent = {
      specversion: '1.0',
      id: this.generateId(),
      source: `plugin:${this.manifest.id}`,
      type,
      time: new Date().toISOString(),
      datacontenttype: 'application/json',
      subject,
      data
    };
    
    await this.context.eventBus.emit(event);
  }
  
  protected getConfig<T = any>(key: string, defaultValue?: T): T {
    return this.context.configStore.get(key) ?? defaultValue;
  }
  
  protected async getStoredData<T = any>(key: string): Promise<T | null> {
    try {
      return await this.context.dataStore.get(key);
    } catch {
      return null;
    }
  }
  
  protected async storeData(key: string, value: any): Promise<void> {
    await this.context.dataStore.set(key, value);
  }
  
  protected log = {
    debug: (message: string, meta?: any) => this.context.logger.debug(message, meta),
    info: (message: string, meta?: any) => this.context.logger.info(message, meta),
    warn: (message: string, meta?: any) => this.context.logger.warn(message, meta),
    error: (message: string, meta?: any) => this.context.logger.error(message, meta),
  };
  
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Decorator to mark a method as an API handler
 */
export function ApiHandler(path: string, method: string = 'GET') {
  return function (target: any, propertyKey: string, _descriptor: PropertyDescriptor) {
    // Store metadata for plugin loader
    if (!target.constructor._apiHandlers) {
      target.constructor._apiHandlers = [];
    }
    target.constructor._apiHandlers.push({
      path,
      method,
      handler: propertyKey
    });
  };
}

/**
 * Decorator to mark a method as an event handler
 */
export function EventHandler(eventType: string, filter?: Record<string, any>) {
  return function (target: any, propertyKey: string, _descriptor: PropertyDescriptor) {
    // Store metadata for plugin loader
    if (!target.constructor._eventHandlers) {
      target.constructor._eventHandlers = [];
    }
    target.constructor._eventHandlers.push({
      eventType,
      filter,
      handler: propertyKey
    });
  };
}

/**
 * Decorator to mark a method as a hook handler
 */
export function HookHandler(hookId: string, order: number = 0) {
  return function (target: any, propertyKey: string, _descriptor: PropertyDescriptor) {
    // Store metadata for plugin loader
    if (!target.constructor._hookHandlers) {
      target.constructor._hookHandlers = [];
    }
    target.constructor._hookHandlers.push({
      hookId,
      order,
      handler: propertyKey
    });
  };
}
