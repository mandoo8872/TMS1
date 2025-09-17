import { Injectable, Logger } from '@nestjs/common';
import { HookContext, HookResult, HookType, HookMode, HookConfigs } from '@tms/plugin-sdk';

interface HookHandler {
  pluginId: string;
  handler: (context: HookContext) => Promise<HookResult>;
  order: number;
}

@Injectable()
export class HookService {
  private readonly logger = new Logger(HookService.name);
  private readonly handlers = new Map<HookType, HookHandler[]>();

  /**
   * Register a hook handler
   */
  registerHandler(
    hookId: HookType,
    pluginId: string,
    handler: (context: HookContext) => Promise<HookResult>,
    order: number = 0,
  ): void {
    const handlers = this.handlers.get(hookId) || [];
    handlers.push({ pluginId, handler, order });
    
    // Sort by order
    handlers.sort((a, b) => a.order - b.order);
    
    this.handlers.set(hookId, handlers);
    this.logger.debug(`Registered handler for hook ${hookId} from plugin ${pluginId}`);
  }

  /**
   * Unregister all handlers for a plugin
   */
  unregisterPlugin(pluginId: string): void {
    for (const [hookId, handlers] of this.handlers.entries()) {
      const filtered = handlers.filter(h => h.pluginId !== pluginId);
      if (filtered.length !== handlers.length) {
        this.handlers.set(hookId, filtered);
        this.logger.debug(`Unregistered handlers for plugin ${pluginId}`);
      }
    }
  }

  /**
   * Execute hook handlers
   */
  async executeHook(
    hookId: HookType,
    data: any,
    metadata?: Record<string, any>,
  ): Promise<HookResult> {
    const handlers = this.handlers.get(hookId) || [];
    if (handlers.length === 0) {
      return { continue: true, data };
    }

    const config = HookConfigs[hookId];
    const context: Omit<HookContext, 'pluginId'> = {
      hookId,
      data,
      metadata,
    };

    switch (config.mode) {
      case HookMode.SEQUENTIAL:
        return await this.executeSequential(handlers, context);
      
      case HookMode.PARALLEL:
        return await this.executeParallel(handlers, context);
      
      case HookMode.WATERFALL:
        return await this.executeWaterfall(handlers, context);
      
      case HookMode.AGGREGATE:
        return await this.executeAggregate(handlers, context);
      
      default:
        return { continue: true, data };
    }
  }

  private async executeSequential(
    handlers: HookHandler[],
    context: Omit<HookContext, 'pluginId'>,
  ): Promise<HookResult> {
    let result: HookResult = { continue: true, data: context.data };
    
    for (const handler of handlers) {
      try {
        result = await handler.handler({ ...context, pluginId: handler.pluginId });
        if (!result.continue || result.error) {
          break;
        }
      } catch (error) {
        this.logger.error(`Hook handler error in plugin ${handler.pluginId}`, error);
        return {
          continue: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
    
    return result;
  }

  private async executeParallel(
    handlers: HookHandler[],
    context: Omit<HookContext, 'pluginId'>,
  ): Promise<HookResult> {
    const promises = handlers.map(handler =>
      handler.handler({ ...context, pluginId: handler.pluginId })
        .catch(error => ({
          continue: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })),
    );
    
    const results = await Promise.all(promises);
    
    // Check if any handler returned an error
    const errorResult = results.find(r => r.error);
    if (errorResult) {
      return errorResult;
    }
    
    // Check if any handler returned continue: false
    const stopResult = results.find(r => !r.continue);
    if (stopResult) {
      return stopResult;
    }
    
    return { continue: true, data: context.data };
  }

  private async executeWaterfall(
    handlers: HookHandler[],
    context: Omit<HookContext, 'pluginId'>,
  ): Promise<HookResult> {
    let currentData = context.data;
    
    for (const handler of handlers) {
      try {
        const result = await handler.handler({
          ...context,
          pluginId: handler.pluginId,
          data: currentData,
        });
        
        if (!result.continue || result.error) {
          return result;
        }
        
        if (result.data !== undefined) {
          currentData = result.data;
        }
      } catch (error) {
        this.logger.error(`Hook handler error in plugin ${handler.pluginId}`, error);
        return {
          continue: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
    
    return { continue: true, data: currentData };
  }

  private async executeAggregate(
    handlers: HookHandler[],
    context: Omit<HookContext, 'pluginId'>,
  ): Promise<HookResult> {
    const results: any[] = [];
    
    for (const handler of handlers) {
      try {
        const result = await handler.handler({
          ...context,
          pluginId: handler.pluginId,
        });
        
        if (result.data !== undefined) {
          results.push(result.data);
        }
      } catch (error) {
        this.logger.error(`Hook handler error in plugin ${handler.pluginId}`, error);
      }
    }
    
    return { continue: true, data: results };
  }
}
