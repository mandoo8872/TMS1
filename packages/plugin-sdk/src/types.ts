import { CloudEvent } from '@tms/contracts';

// Plugin manifest
export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  license?: string;
  main: string; // Entry point
  dependencies?: Record<string, string>;
  capabilities: PluginCapabilities;
  configuration?: PluginConfigSchema;
}

export interface PluginCapabilities {
  apis?: ApiCapability[];
  events?: EventCapability[];
  uiSlots?: UiSlotCapability[];
  workflows?: WorkflowCapability[];
  hooks?: HookCapability[];
}

export interface ApiCapability {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  handler: string; // Handler function name
  middleware?: string[]; // Middleware function names
}

export interface EventCapability {
  eventType: string;
  handler: string; // Handler function name
  filter?: Record<string, any>; // Event filter criteria
}

export interface UiSlotCapability {
  slotId: string;
  component: string; // Component export name
  props?: Record<string, any>;
  order?: number;
}

export interface WorkflowCapability {
  id: string;
  name: string;
  trigger: WorkflowTrigger;
  steps: WorkflowStep[];
}

export interface HookCapability {
  hookId: string;
  handler: string; // Handler function name
  order?: number;
}

// Plugin configuration
export interface PluginConfigSchema {
  properties: Record<string, ConfigProperty>;
  required?: string[];
}

export interface ConfigProperty {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  default?: any;
  enum?: any[];
  minimum?: number;
  maximum?: number;
  pattern?: string;
}

// Plugin lifecycle
export enum PluginStatus {
  INSTALLED = 'INSTALLED',
  ENABLED = 'ENABLED',
  DISABLED = 'DISABLED',
  ERROR = 'ERROR'
}

export interface PluginInstance {
  manifest: PluginManifest;
  status: PluginStatus;
  config?: Record<string, any>;
  installedAt: Date;
  enabledAt?: Date;
  disabledAt?: Date;
  error?: string;
}

// Workflow types
export interface WorkflowTrigger {
  type: 'EVENT' | 'SCHEDULE' | 'MANUAL' | 'WEBHOOK';
  event?: string; // For EVENT type
  schedule?: string; // Cron expression for SCHEDULE type
  webhook?: string; // Webhook path for WEBHOOK type
}

export interface WorkflowStep {
  id: string;
  type: 'ACTION' | 'CONDITION' | 'PARALLEL' | 'LOOP';
  action?: string; // Action handler for ACTION type
  condition?: WorkflowCondition; // For CONDITION type
  branches?: WorkflowBranch[]; // For CONDITION type
  steps?: WorkflowStep[]; // For PARALLEL and LOOP types
  iterator?: string; // For LOOP type
}

export interface WorkflowCondition {
  expression: string; // JavaScript expression
  context?: string[]; // Available context variables
}

export interface WorkflowBranch {
  condition: string; // Branch condition
  steps: WorkflowStep[];
}

// Hook types
export interface HookContext {
  pluginId: string;
  hookId: string;
  data: any;
  metadata?: Record<string, any>;
}

export interface HookResult {
  continue: boolean;
  data?: any;
  error?: string;
}

// Plugin API
export interface PluginApi {
  // Lifecycle methods
  install(config?: Record<string, any>): Promise<void>;
  enable(): Promise<void>;
  disable(): Promise<void>;
  uninstall(): Promise<void>;
  upgrade(fromVersion: string): Promise<void>;
  
  // Runtime methods
  handleRequest?(req: PluginRequest): Promise<PluginResponse>;
  handleEvent?(event: CloudEvent): Promise<void>;
  handleHook?(context: HookContext): Promise<HookResult>;
  
  // UI methods
  getComponent?(componentId: string): any;
  
  // Workflow methods
  executeAction?(actionId: string, context: any): Promise<any>;
}

// Request/Response types
export interface PluginRequest {
  method: string;
  path: string;
  params?: Record<string, any>;
  query?: Record<string, any>;
  body?: any;
  headers?: Record<string, string>;
  user?: any;
}

export interface PluginResponse {
  status: number;
  body?: any;
  headers?: Record<string, string>;
}

// Plugin context interface
export interface PluginContext {
  // Core services
  eventBus: EventBus;
  dataStore: DataStore;
  configStore: ConfigStore;
  logger: Logger;
  
  // Domain services
  getService(name: string): any;
  
  // Plugin info
  pluginId: string;
  pluginVersion: string;
}

// Service interfaces
export interface EventBus {
  emit(event: CloudEvent): Promise<void>;
  on(eventType: string, handler: (event: CloudEvent) => Promise<void>): void;
  off(eventType: string, handler: (event: CloudEvent) => Promise<void>): void;
}

export interface DataStore {
  get(key: string): Promise<any>;
  set(key: string, value: any): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix?: string): Promise<string[]>;
}

export interface ConfigStore {
  get(key: string): any;
  set(key: string, value: any): void;
  getAll(): Record<string, any>;
}

export interface Logger {
  debug(message: string, meta?: any): void;
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
}
