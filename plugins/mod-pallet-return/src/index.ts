import { 
  Plugin,
  ApiHandler,
  EventHandler,
  HookHandler,
  PluginRequest,
  PluginResponse,
  HookContext,
  HookResult,
} from '@tms/plugin-sdk';
import { CloudEvent, ShipmentEventData } from '@tms/contracts';
import { PalletService } from './services/pallet.service';
import { PalletRepository } from './repositories/pallet.repository';

export default class PalletReturnPlugin extends Plugin {
  private palletService!: PalletService;
  private palletRepository!: PalletRepository;

  async install(config?: Record<string, any>): Promise<void> {
    await super.install(config);
    
    // Initialize services
    this.palletRepository = new PalletRepository(this.context.dataStore);
    this.palletService = new PalletService(
      this.palletRepository,
      this.getConfig('returnDueDays', 30)
    );
    
    this.log.info('Pallet Return plugin installed');
  }

  async enable(): Promise<void> {
    await super.enable();
    this.log.info('Pallet Return plugin enabled');
  }

  async disable(): Promise<void> {
    await super.disable();
    this.log.info('Pallet Return plugin disabled');
  }

  // API Handlers
  @ApiHandler('/pallets', 'GET')
  async getPallets(req: PluginRequest): Promise<PluginResponse> {
    try {
      const { shipmentId, status } = req.query || {};
      const pallets = await this.palletService.getPallets({ shipmentId, status });
      
      return {
        status: 200,
        body: { pallets },
      };
    } catch (error) {
      this.log.error('Failed to get pallets', error);
      return {
        status: 500,
        body: { error: 'Failed to get pallets' },
      };
    }
  }

  @ApiHandler('/pallets', 'POST')
  async createPallet(req: PluginRequest): Promise<PluginResponse> {
    try {
      const pallet = await this.palletService.createPallet(req.body);
      
      return {
        status: 201,
        body: pallet,
      };
    } catch (error) {
      this.log.error('Failed to create pallet', error);
      return {
        status: 400,
        body: { error: error instanceof Error ? error.message : 'Failed to create pallet' },
      };
    }
  }

  @ApiHandler('/pallets/:id/return', 'POST')
  async returnPallet(req: PluginRequest): Promise<PluginResponse> {
    try {
      const palletId = req.params?.id;
      if (!palletId) {
        return {
          status: 400,
          body: { error: 'Pallet ID required' },
        };
      }
      
      const { returnLocation, condition } = req.body || {};
      const pallet = await this.palletService.returnPallet(palletId, {
        returnLocation,
        condition,
      });
      
      return {
        status: 200,
        body: pallet,
      };
    } catch (error) {
      this.log.error('Failed to return pallet', error);
      return {
        status: 400,
        body: { error: error instanceof Error ? error.message : 'Failed to return pallet' },
      };
    }
  }

  // Event Handlers
  @EventHandler('com.tms.shipment.delivered')
  async onShipmentDelivered(event: CloudEvent<ShipmentEventData>): Promise<void> {
    if (!event.data) return;
    
    const { shipmentId } = event.data;
    this.log.info(`Processing delivered shipment ${shipmentId} for pallet tracking`);
    
    try {
      // Create pallet records for the delivered shipment
      await this.palletService.createPalletsForShipment(shipmentId);
      
      // Emit custom event
      await this.emitEvent(
        'com.tms.plugin.pallet.created',
        { shipmentId, timestamp: new Date().toISOString() },
        shipmentId
      );
    } catch (error) {
      this.log.error(`Failed to process shipment ${shipmentId}`, error);
    }
  }

  // Hook Handlers
  @HookHandler('shipment.after.deliver', 10)
  async afterShipmentDeliver(context: HookContext): Promise<HookResult> {
    const { shipmentId } = context.data;
    
    try {
      // Check if pallets need to be tracked for this shipment
      const shipment = await this.context.getService('shipmentService').findOne(shipmentId);
      
      if (shipment.metadata?.requiresPalletReturn) {
        await this.palletService.createPalletsForShipment(shipmentId);
        this.log.info(`Created pallet records for shipment ${shipmentId}`);
      }
      
      return { continue: true };
    } catch (error) {
      this.log.error(`Hook failed for shipment ${shipmentId}`, error);
      return { 
        continue: true, // Don't block shipment delivery
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Workflow Actions
  async checkOverduePallets(): Promise<any> {
    this.log.info('Checking for overdue pallets');
    
    const overduePallets = await this.palletService.getOverduePallets();
    
    if (overduePallets.length > 0) {
      this.log.info(`Found ${overduePallets.length} overdue pallets`);
      
      // Store for next step
      await this.storeData('workflow.overduePallets', overduePallets);
    }
    
    return { overdueCount: overduePallets.length };
  }

  async sendReminderEmails(): Promise<any> {
    if (!this.getConfig('reminderEnabled')) {
      this.log.info('Reminder emails disabled');
      return { sent: 0 };
    }
    
    const overduePallets = await this.getStoredData<any[]>('workflow.overduePallets');
    if (!overduePallets || overduePallets.length === 0) {
      return { sent: 0 };
    }
    
    const fromEmail = this.getConfig('reminderEmail');
    if (!fromEmail) {
      this.log.warn('Reminder email not configured');
      return { sent: 0 };
    }
    
    // In a real implementation, this would send actual emails
    let sent = 0;
    for (const pallet of overduePallets) {
      this.log.info(`Would send reminder email for pallet ${pallet.id}`);
      sent++;
    }
    
    // Clean up stored data
    await this.storeData('workflow.overduePallets', null);
    
    return { sent };
  }

  // UI Component (exported for web app)
  getComponent(componentId: string): any {
    if (componentId === 'PalletReturnTab') {
      // In a real implementation, this would return a React component
      return {
        name: 'PalletReturnTab',
        props: {
          title: 'Pallet Returns',
        },
      };
    }
    return null;
  }
}
