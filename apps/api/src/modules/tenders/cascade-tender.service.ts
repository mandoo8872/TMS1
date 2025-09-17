import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { EventBusService } from '@/kernel/services/event-bus.service';
import { ContractService } from '@/kernel/services/contract.service';
import { HookService } from '@/kernel/services/hook.service';
import { PartyGraphService } from '../parties/party-graph.service';
import { 
  Tender,
  CascadeTenderRequest,
  CascadeTenderRequestSchema,
  TenderSchema,
  EventTypes,
  TenderEventData,
} from '@tms/contracts';
import { Hooks } from '@tms/plugin-sdk';

interface CascadeResult {
  rootTenderId: string;
  createdTenders: Tender[];
  totalTiers: number;
}

@Injectable()
export class CascadeTenderService {
  private readonly logger = new Logger(CascadeTenderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly contracts: ContractService,
    private readonly hooks: HookService,
    private readonly partyGraph: PartyGraphService,
  ) {}

  /**
   * Create cascade tenders across multiple tiers
   */
  async createCascadeTenders(
    brokerId: string,
    request: CascadeTenderRequest,
  ): Promise<CascadeResult> {
    // Validate request
    const validated = this.contracts.validate(CascadeTenderRequestSchema, request);

    // Execute before hook
    const hookResult = await this.hooks.executeHook(
      Hooks.BEFORE_TENDER_CASCADE,
      { brokerId, request: validated },
    );

    if (!hookResult.continue) {
      throw new BadRequestException(hookResult.error || 'Cascade tender blocked by plugin');
    }

    const cascadeData = hookResult.data?.request || validated;

    // Verify order exists
    const order = await this.prisma.order.findUnique({
      where: { id: cascadeData.orderId },
    });

    if (!order) {
      throw new BadRequestException(`Order ${cascadeData.orderId} not found`);
    }

    // Get carriers by tier from party graph
    const carrierTiers = await this.partyGraph.getCarriersByTier(brokerId);

    // Validate requested tiers match available carriers
    this.validateTierConfiguration(cascadeData.tiers, carrierTiers);

    // Create tenders based on mode
    let result: CascadeResult;
    
    if (cascadeData.mode === 'SEQUENTIAL') {
      result = await this.createSequentialTenders(
        order,
        cascadeData,
        carrierTiers,
      );
    } else {
      result = await this.createParallelTenders(
        order,
        cascadeData,
        carrierTiers,
      );
    }

    // Execute after hook
    await this.hooks.executeHook(Hooks.AFTER_TENDER_CASCADE, result);

    // Emit event
    await this.eventBus.emitDomainEvent<TenderEventData>(
      EventTypes.TENDER_CASCADED,
      {
        tenderId: result.rootTenderId,
        tenderNumber: result.createdTenders[0].tenderNumber,
        orderId: order.id,
        shipmentId: undefined,
        status: 'OPEN',
        mode: cascadeData.mode,
        tier: 0,
        parentTenderId: undefined,
      },
      { subject: result.rootTenderId },
    );

    return result;
  }

  /**
   * Create sequential cascade tenders
   * Opens one tier at a time, next tier opens only if current tier fails
   */
  private async createSequentialTenders(
    order: any,
    request: CascadeTenderRequest,
    carrierTiers: any[],
  ): Promise<CascadeResult> {
    const createdTenders: Tender[] = [];
    let parentTenderId: string | undefined;

    // Create tenders for each tier
    for (const tierConfig of request.tiers) {
      const carriersAtTier = carrierTiers.find(ct => ct.tier === tierConfig.tier);
      if (!carriersAtTier) continue;

      // Filter carriers based on request
      const selectedCarriers = tierConfig.carrierIds.length > 0
        ? carriersAtTier.carriers.filter((c: any) => tierConfig.carrierIds.includes(c.id))
        : carriersAtTier.carriers;

      if (selectedCarriers.length === 0) continue;

      // Calculate offer deadline
      const offerDeadline = new Date();
      offerDeadline.setMinutes(offerDeadline.getMinutes() + tierConfig.offerDeadlineMinutes);

      // Create tender
      const tender = await this.prisma.tender.create({
        data: {
          tenderNumber: await this.generateTenderNumber(tierConfig.tier),
          orderId: order.id,
          status: tierConfig.tier === 0 ? 'OPEN' : 'DRAFT', // Only first tier is open initially
          mode: 'SEQUENTIAL',
          tier: tierConfig.tier,
          parentTenderId,
          offerDeadline,
        },
        include: {
          offers: true,
        },
      });

      // Create pending offers for carriers
      await this.prisma.tenderOffer.createMany({
        data: selectedCarriers.map((carrier: any) => ({
          tenderId: tender.id,
          carrierId: carrier.id,
          status: 'PENDING',
          priceAmount: 0,
          priceCurrency: 'USD',
          validUntil: offerDeadline,
          conditions: [],
        })),
      });

      const completeTender = await this.prisma.tender.findUnique({
        where: { id: tender.id },
        include: {
          offers: {
            include: { carrier: true },
          },
        },
      });

      createdTenders.push(this.contracts.transform(TenderSchema, completeTender));
      
      if (tierConfig.tier === 0) {
        parentTenderId = tender.id;
      }
    }

    // Set up cascade triggers
    await this.setupSequentialCascadeTriggers(createdTenders);

    return {
      rootTenderId: createdTenders[0].id,
      createdTenders,
      totalTiers: createdTenders.length,
    };
  }

  /**
   * Create parallel cascade tenders
   * Opens all tiers simultaneously
   */
  private async createParallelTenders(
    order: any,
    request: CascadeTenderRequest,
    carrierTiers: any[],
  ): Promise<CascadeResult> {
    const createdTenders: Tender[] = [];
    const rootTenderNumber = await this.generateTenderNumber(0);

    // Create all tenders in parallel
    const tenderPromises = request.tiers.map(async (tierConfig) => {
      const carriersAtTier = carrierTiers.find(ct => ct.tier === tierConfig.tier);
      if (!carriersAtTier) return null;

      // Filter carriers based on request
      const selectedCarriers = tierConfig.carrierIds.length > 0
        ? carriersAtTier.carriers.filter((c: any) => tierConfig.carrierIds.includes(c.id))
        : carriersAtTier.carriers;

      if (selectedCarriers.length === 0) return null;

      // Calculate offer deadline
      const offerDeadline = new Date();
      offerDeadline.setMinutes(offerDeadline.getMinutes() + tierConfig.offerDeadlineMinutes);

      // Create tender
      const tender = await this.prisma.tender.create({
        data: {
          tenderNumber: `${rootTenderNumber}-T${tierConfig.tier}`,
          orderId: order.id,
          status: 'OPEN', // All tiers open immediately
          mode: 'PARALLEL',
          tier: tierConfig.tier,
          offerDeadline,
        },
      });

      // Create pending offers for carriers
      await this.prisma.tenderOffer.createMany({
        data: selectedCarriers.map((carrier: any) => ({
          tenderId: tender.id,
          carrierId: carrier.id,
          status: 'PENDING',
          priceAmount: 0,
          priceCurrency: 'USD',
          validUntil: offerDeadline,
          conditions: [],
        })),
      });

      return tender.id;
    });

    const tenderIds = (await Promise.all(tenderPromises)).filter(id => id !== null) as string[];

    // Fetch complete tenders with offers
    const tenders = await this.prisma.tender.findMany({
      where: { id: { in: tenderIds } },
      include: {
        offers: {
          include: { carrier: true },
        },
      },
      orderBy: { tier: 'asc' },
    });

    const transformedTenders = tenders.map(t => this.contracts.transform(TenderSchema, t));

    return {
      rootTenderId: transformedTenders[0].id,
      createdTenders: transformedTenders,
      totalTiers: transformedTenders.length,
    };
  }

  /**
   * Set up triggers for sequential cascade
   */
  private async setupSequentialCascadeTriggers(tenders: Tender[]): Promise<void> {
    // Subscribe to tender close events to trigger next tier
    for (let i = 0; i < tenders.length - 1; i++) {
      const currentTender = tenders[i];
      const nextTender = tenders[i + 1];

      // Set up event listener for current tender closure
      this.eventBus.on(EventTypes.TENDER_CLOSED, async (event) => {
        if (event.data?.tenderId === currentTender.id) {
          // Check if any offers were accepted
          const tender = await this.prisma.tender.findUnique({
            where: { id: currentTender.id },
            include: { offers: true },
          });

          const hasAcceptedOffer = tender?.offers.some(o => o.status === 'ACCEPTED');

          if (!hasAcceptedOffer && tender?.status === 'CLOSED') {
            // No offers accepted, open next tier
            await this.openNextTier(nextTender.id);
          }
        }
      });
    }
  }

  /**
   * Open the next tier in cascade
   */
  private async openNextTier(tenderId: string): Promise<void> {
    this.logger.log(`Opening next tier tender: ${tenderId}`);

    const tender = await this.prisma.tender.update({
      where: { id: tenderId },
      data: { status: 'OPEN' },
    });

    // Emit event
    await this.eventBus.emitDomainEvent<TenderEventData>(
      EventTypes.TENDER_OPENED,
      {
        tenderId: tender.id,
        tenderNumber: tender.tenderNumber,
        orderId: tender.orderId,
        shipmentId: tender.shipmentId,
        status: tender.status,
        mode: tender.mode,
        tier: tender.tier,
        parentTenderId: tender.parentTenderId,
      },
      { subject: tender.id },
    );
  }

  /**
   * Validate tier configuration against available carriers
   */
  private validateTierConfiguration(
    requestedTiers: any[],
    availableCarrierTiers: any[],
  ): void {
    for (const tier of requestedTiers) {
      const available = availableCarrierTiers.find(ct => ct.tier === tier.tier);
      
      if (!available) {
        throw new BadRequestException(`No carriers available at tier ${tier.tier}`);
      }

      if (tier.carrierIds.length > 0) {
        const availableIds = available.carriers.map((c: any) => c.id);
        const invalidIds = tier.carrierIds.filter((id: string) => !availableIds.includes(id));
        
        if (invalidIds.length > 0) {
          throw new BadRequestException(
            `Invalid carrier IDs for tier ${tier.tier}: ${invalidIds.join(', ')}`
          );
        }
      }
    }
  }

  private async generateTenderNumber(tier: number): Promise<string> {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    const count = await this.prisma.tender.count({
      where: {
        createdAt: {
          gte: new Date(date.setHours(0, 0, 0, 0)),
          lte: new Date(date.setHours(23, 59, 59, 999)),
        },
      },
    });
    
    const sequence = String(count + 1).padStart(4, '0');
    return `TND-${year}${month}${day}-${sequence}`;
  }
}