/**
 * Built-in hook points in TMS Kernel
 * Plugins can register handlers for these hooks
 */

export const Hooks = {
  // Order hooks
  BEFORE_ORDER_CREATE: 'order.before.create',
  AFTER_ORDER_CREATE: 'order.after.create',
  BEFORE_ORDER_UPDATE: 'order.before.update',
  AFTER_ORDER_UPDATE: 'order.after.update',
  BEFORE_ORDER_CANCEL: 'order.before.cancel',
  AFTER_ORDER_CANCEL: 'order.after.cancel',
  
  // Shipment hooks
  BEFORE_SHIPMENT_CREATE: 'shipment.before.create',
  AFTER_SHIPMENT_CREATE: 'shipment.after.create',
  BEFORE_SHIPMENT_DISPATCH: 'shipment.before.dispatch',
  AFTER_SHIPMENT_DISPATCH: 'shipment.after.dispatch',
  BEFORE_SHIPMENT_DELIVER: 'shipment.before.deliver',
  AFTER_SHIPMENT_DELIVER: 'shipment.after.deliver',
  
  // Stage hooks
  BEFORE_STAGE_ADVANCE: 'stage.before.advance',
  AFTER_STAGE_ADVANCE: 'stage.after.advance',
  BEFORE_STAGE_COMPLETE: 'stage.before.complete',
  AFTER_STAGE_COMPLETE: 'stage.after.complete',
  
  // Tender hooks
  BEFORE_TENDER_CREATE: 'tender.before.create',
  AFTER_TENDER_CREATE: 'tender.after.create',
  BEFORE_TENDER_CASCADE: 'tender.before.cascade',
  AFTER_TENDER_CASCADE: 'tender.after.cascade',
  BEFORE_TENDER_AWARD: 'tender.before.award',
  AFTER_TENDER_AWARD: 'tender.after.award',
  
  // Offer hooks
  BEFORE_OFFER_SUBMIT: 'offer.before.submit',
  AFTER_OFFER_SUBMIT: 'offer.after.submit',
  BEFORE_OFFER_ACCEPT: 'offer.before.accept',
  AFTER_OFFER_ACCEPT: 'offer.after.accept',
  
  // Settlement hooks
  BEFORE_SETTLEMENT_CREATE: 'settlement.before.create',
  AFTER_SETTLEMENT_CREATE: 'settlement.after.create',
  BEFORE_SETTLEMENT_PROCESS: 'settlement.before.process',
  AFTER_SETTLEMENT_PROCESS: 'settlement.after.process',
  
  // Party hooks
  BEFORE_PARTY_CREATE: 'party.before.create',
  AFTER_PARTY_CREATE: 'party.after.create',
  BEFORE_RELATION_CREATE: 'relation.before.create',
  AFTER_RELATION_CREATE: 'relation.after.create',
  
  // System hooks
  PLUGIN_INSTALL: 'system.plugin.install',
  PLUGIN_ENABLE: 'system.plugin.enable',
  PLUGIN_DISABLE: 'system.plugin.disable',
  PLUGIN_UPGRADE: 'system.plugin.upgrade',
} as const;

export type HookType = typeof Hooks[keyof typeof Hooks];

/**
 * Hook execution modes
 */
export enum HookMode {
  // Execute all handlers in sequence, stop on first error
  SEQUENTIAL = 'SEQUENTIAL',
  
  // Execute all handlers in parallel
  PARALLEL = 'PARALLEL',
  
  // Execute handlers until one returns continue: false
  WATERFALL = 'WATERFALL',
  
  // Execute all handlers, collect all results
  AGGREGATE = 'AGGREGATE'
}

/**
 * Hook configuration
 */
export interface HookConfig {
  id: HookType;
  mode: HookMode;
  timeout?: number; // Max execution time in ms
  required?: boolean; // If true, at least one handler must succeed
}

/**
 * Default hook configurations
 */
export const HookConfigs: Record<HookType, HookConfig> = {
  // Order hooks - waterfall to allow validation/modification
  [Hooks.BEFORE_ORDER_CREATE]: { id: Hooks.BEFORE_ORDER_CREATE, mode: HookMode.WATERFALL },
  [Hooks.AFTER_ORDER_CREATE]: { id: Hooks.AFTER_ORDER_CREATE, mode: HookMode.PARALLEL },
  [Hooks.BEFORE_ORDER_UPDATE]: { id: Hooks.BEFORE_ORDER_UPDATE, mode: HookMode.WATERFALL },
  [Hooks.AFTER_ORDER_UPDATE]: { id: Hooks.AFTER_ORDER_UPDATE, mode: HookMode.PARALLEL },
  [Hooks.BEFORE_ORDER_CANCEL]: { id: Hooks.BEFORE_ORDER_CANCEL, mode: HookMode.WATERFALL },
  [Hooks.AFTER_ORDER_CANCEL]: { id: Hooks.AFTER_ORDER_CANCEL, mode: HookMode.PARALLEL },
  
  // Shipment hooks
  [Hooks.BEFORE_SHIPMENT_CREATE]: { id: Hooks.BEFORE_SHIPMENT_CREATE, mode: HookMode.WATERFALL },
  [Hooks.AFTER_SHIPMENT_CREATE]: { id: Hooks.AFTER_SHIPMENT_CREATE, mode: HookMode.PARALLEL },
  [Hooks.BEFORE_SHIPMENT_DISPATCH]: { id: Hooks.BEFORE_SHIPMENT_DISPATCH, mode: HookMode.WATERFALL },
  [Hooks.AFTER_SHIPMENT_DISPATCH]: { id: Hooks.AFTER_SHIPMENT_DISPATCH, mode: HookMode.PARALLEL },
  [Hooks.BEFORE_SHIPMENT_DELIVER]: { id: Hooks.BEFORE_SHIPMENT_DELIVER, mode: HookMode.WATERFALL },
  [Hooks.AFTER_SHIPMENT_DELIVER]: { id: Hooks.AFTER_SHIPMENT_DELIVER, mode: HookMode.PARALLEL },
  
  // Stage hooks - waterfall for dependency checks
  [Hooks.BEFORE_STAGE_ADVANCE]: { id: Hooks.BEFORE_STAGE_ADVANCE, mode: HookMode.WATERFALL, timeout: 5000 },
  [Hooks.AFTER_STAGE_ADVANCE]: { id: Hooks.AFTER_STAGE_ADVANCE, mode: HookMode.PARALLEL },
  [Hooks.BEFORE_STAGE_COMPLETE]: { id: Hooks.BEFORE_STAGE_COMPLETE, mode: HookMode.WATERFALL },
  [Hooks.AFTER_STAGE_COMPLETE]: { id: Hooks.AFTER_STAGE_COMPLETE, mode: HookMode.PARALLEL },
  
  // Tender hooks
  [Hooks.BEFORE_TENDER_CREATE]: { id: Hooks.BEFORE_TENDER_CREATE, mode: HookMode.WATERFALL },
  [Hooks.AFTER_TENDER_CREATE]: { id: Hooks.AFTER_TENDER_CREATE, mode: HookMode.PARALLEL },
  [Hooks.BEFORE_TENDER_CASCADE]: { id: Hooks.BEFORE_TENDER_CASCADE, mode: HookMode.WATERFALL },
  [Hooks.AFTER_TENDER_CASCADE]: { id: Hooks.AFTER_TENDER_CASCADE, mode: HookMode.PARALLEL },
  [Hooks.BEFORE_TENDER_AWARD]: { id: Hooks.BEFORE_TENDER_AWARD, mode: HookMode.WATERFALL },
  [Hooks.AFTER_TENDER_AWARD]: { id: Hooks.AFTER_TENDER_AWARD, mode: HookMode.PARALLEL },
  
  // Offer hooks
  [Hooks.BEFORE_OFFER_SUBMIT]: { id: Hooks.BEFORE_OFFER_SUBMIT, mode: HookMode.WATERFALL },
  [Hooks.AFTER_OFFER_SUBMIT]: { id: Hooks.AFTER_OFFER_SUBMIT, mode: HookMode.PARALLEL },
  [Hooks.BEFORE_OFFER_ACCEPT]: { id: Hooks.BEFORE_OFFER_ACCEPT, mode: HookMode.WATERFALL },
  [Hooks.AFTER_OFFER_ACCEPT]: { id: Hooks.AFTER_OFFER_ACCEPT, mode: HookMode.PARALLEL },
  
  // Settlement hooks
  [Hooks.BEFORE_SETTLEMENT_CREATE]: { id: Hooks.BEFORE_SETTLEMENT_CREATE, mode: HookMode.WATERFALL },
  [Hooks.AFTER_SETTLEMENT_CREATE]: { id: Hooks.AFTER_SETTLEMENT_CREATE, mode: HookMode.PARALLEL },
  [Hooks.BEFORE_SETTLEMENT_PROCESS]: { id: Hooks.BEFORE_SETTLEMENT_PROCESS, mode: HookMode.WATERFALL },
  [Hooks.AFTER_SETTLEMENT_PROCESS]: { id: Hooks.AFTER_SETTLEMENT_PROCESS, mode: HookMode.PARALLEL },
  
  // Party hooks
  [Hooks.BEFORE_PARTY_CREATE]: { id: Hooks.BEFORE_PARTY_CREATE, mode: HookMode.WATERFALL },
  [Hooks.AFTER_PARTY_CREATE]: { id: Hooks.AFTER_PARTY_CREATE, mode: HookMode.PARALLEL },
  [Hooks.BEFORE_RELATION_CREATE]: { id: Hooks.BEFORE_RELATION_CREATE, mode: HookMode.WATERFALL },
  [Hooks.AFTER_RELATION_CREATE]: { id: Hooks.AFTER_RELATION_CREATE, mode: HookMode.PARALLEL },
  
  // System hooks
  [Hooks.PLUGIN_INSTALL]: { id: Hooks.PLUGIN_INSTALL, mode: HookMode.SEQUENTIAL },
  [Hooks.PLUGIN_ENABLE]: { id: Hooks.PLUGIN_ENABLE, mode: HookMode.SEQUENTIAL },
  [Hooks.PLUGIN_DISABLE]: { id: Hooks.PLUGIN_DISABLE, mode: HookMode.SEQUENTIAL },
  [Hooks.PLUGIN_UPGRADE]: { id: Hooks.PLUGIN_UPGRADE, mode: HookMode.SEQUENTIAL },
};
