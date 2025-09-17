import { CloudEvent } from '@tms/contracts';
import { EventEmitter } from 'eventemitter3';
import {
  PluginContext,
  EventBus,
  DataStore,
  ConfigStore,
  Logger,
} from './types';

/**
 * Default implementation of PluginContext
 */
export class DefaultPluginContext implements PluginContext {
  public readonly pluginId: string;
  public readonly pluginVersion: string;
  public readonly eventBus: EventBus;
  public readonly dataStore: DataStore;
  public readonly configStore: ConfigStore;
  public readonly logger: Logger;
  
  private services: Map<string, any> = new Map();
  
  constructor(
    pluginId: string,
    pluginVersion: string,
    options: {
      eventBus?: EventBus;
      dataStore?: DataStore;
      configStore?: ConfigStore;
      logger?: Logger;
      services?: Map<string, any>;
    } = {}
  ) {
    this.pluginId = pluginId;
    this.pluginVersion = pluginVersion;
    this.eventBus = options.eventBus || new DefaultEventBus();
    this.dataStore = options.dataStore || new InMemoryDataStore();
    this.configStore = options.configStore || new InMemoryConfigStore();
    this.logger = options.logger || new ConsoleLogger(pluginId);
    this.services = options.services || new Map();
  }
  
  getService(name: string): any {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service '${name}' not found`);
    }
    return service;
  }
}

/**
 * Default EventBus implementation
 */
export class DefaultEventBus implements EventBus {
  private emitter = new EventEmitter();

  async emit(event: CloudEvent): Promise<void> {
    this.emitter.emit(event.type, event);
    this.emitter.emit('*', event); // Wildcard for all events
  }
  
  on(eventType: string, handler: (event: CloudEvent) => Promise<void>): void {
    this.emitter.on(eventType, handler);
  }
  
  off(eventType: string, handler: (event: CloudEvent) => Promise<void>): void {
    this.emitter.off(eventType, handler);
  }
}

/**
 * In-memory DataStore implementation
 */
export class InMemoryDataStore implements DataStore {
  private store: Map<string, any> = new Map();
  
  async get(key: string): Promise<any> {
    return this.store.get(key);
  }
  
  async set(key: string, value: any): Promise<void> {
    this.store.set(key, value);
  }
  
  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
  
  async list(prefix?: string): Promise<string[]> {
    const keys = Array.from(this.store.keys());
    if (!prefix) return keys;
    return keys.filter(key => key.startsWith(prefix));
  }
}

/**
 * In-memory ConfigStore implementation
 */
export class InMemoryConfigStore implements ConfigStore {
  private config: Record<string, any> = {};
  
  constructor(initialConfig?: Record<string, any>) {
    this.config = initialConfig || {};
  }
  
  get(key: string): any {
    return this.config[key];
  }
  
  set(key: string, value: any): void {
    this.config[key] = value;
  }
  
  getAll(): Record<string, any> {
    return { ...this.config };
  }
}

/**
 * Console logger implementation
 */
export class ConsoleLogger implements Logger {
  constructor(private prefix: string) {}
  
  private format(level: string, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level}] [${this.prefix}] ${message}${metaStr}`;
  }
  
  debug(message: string, meta?: any): void {
    console.debug(this.format('DEBUG', message, meta));
  }
  
  info(message: string, meta?: any): void {
    console.info(this.format('INFO', message, meta));
  }
  
  warn(message: string, meta?: any): void {
    console.warn(this.format('WARN', message, meta));
  }
  
  error(message: string, meta?: any): void {
    console.error(this.format('ERROR', message, meta));
  }
}

/**
 * Factory to create plugin contexts
 */
export class PluginContextFactory {
  private eventBus: EventBus;
  private services: Map<string, any>;
  private loggerFactory: (pluginId: string) => Logger;
  
  constructor(options: {
    eventBus?: EventBus;
    services?: Map<string, any>;
    loggerFactory?: (pluginId: string) => Logger;
  } = {}) {
    this.eventBus = options.eventBus || new DefaultEventBus();
    this.services = options.services || new Map();
    this.loggerFactory = options.loggerFactory || ((id) => new ConsoleLogger(id));
  }
  
  createContext(
    pluginId: string,
    pluginVersion: string,
    config?: Record<string, any>
  ): PluginContext {
    return new DefaultPluginContext(pluginId, pluginVersion, {
      eventBus: this.eventBus,
      dataStore: new InMemoryDataStore(), // Each plugin gets its own data store
      configStore: new InMemoryConfigStore(config),
      logger: this.loggerFactory(pluginId),
      services: this.services
    });
  }
}
