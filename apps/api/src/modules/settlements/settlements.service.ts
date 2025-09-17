import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { EventBusService } from '@/kernel/services/event-bus.service';
import { ContractService } from '@/kernel/services/contract.service';
import { HookService } from '@/kernel/services/hook.service';
import { 
  Settlement, 
  SettlementSchema,
  SettlementLink,
  EventTypes,
  SettlementEventData,
} from '@tms/contracts';
import { Hooks } from '@tms/plugin-sdk';
import { CreateSettlementDto } from './dto/create-settlement.dto';
import { CreateSettlementLinkDto } from './dto/create-settlement-link.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class SettlementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly contracts: ContractService,
    private readonly hooks: HookService,
  ) {}

  async create(createDto: CreateSettlementDto): Promise<Settlement> {
    // Validate contract
    const validated = this.contracts.validate(
      SettlementSchema.omit({ 
        id: true,
        settlementNumber: true,
        links: true,
        createdAt: true, 
        updatedAt: true 
      }), 
      createDto,
    );

    // Execute before hook
    const hookResult = await this.hooks.executeHook(
      Hooks.BEFORE_SETTLEMENT_CREATE,
      validated,
    );

    if (!hookResult.continue) {
      throw new BadRequestException(hookResult.error || 'Settlement creation blocked by plugin');
    }

    const settlementData = hookResult.data || validated;

    // Verify shipment exists
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: settlementData.shipmentId },
      include: {
        order: {
          include: {
            shipper: true,
            consignee: true,
          },
        },
        carrier: true,
      },
    });

    if (!shipment) {
      throw new NotFoundException(`Shipment ${settlementData.shipmentId} not found`);
    }

    // Generate settlement number
    const settlementNumber = await this.generateSettlementNumber();

    // Create settlement
    const settlement = await this.prisma.settlement.create({
      data: {
        ...settlementData,
        settlementNumber,
        totalAmount: 0, // Will be calculated after links are added
        totalCurrency: 'USD',
      },
    });

    // Execute after hook
    await this.hooks.executeHook(Hooks.AFTER_SETTLEMENT_CREATE, settlement);

    // Emit event
    await this.eventBus.emitDomainEvent<SettlementEventData>(
      EventTypes.SETTLEMENT_INITIATED,
      {
        settlementId: settlement.id,
        settlementNumber: settlement.settlementNumber,
        chainId: settlement.chainId,
        shipmentId: settlement.shipmentId,
        status: settlement.status,
        totalAmount: {
          amount: settlement.totalAmount,
          currency: settlement.totalCurrency,
        },
        linkCount: 0,
      },
      { subject: settlement.id },
    );

    return this.contracts.transform(SettlementSchema, {
      ...settlement,
      links: [],
    });
  }

  async addLink(
    settlementId: string,
    createLinkDto: CreateSettlementLinkDto,
  ): Promise<SettlementLink> {
    // Verify settlement exists
    const settlement = await this.prisma.settlement.findUnique({
      where: { id: settlementId },
      include: { links: true },
    });

    if (!settlement) {
      throw new NotFoundException(`Settlement ${settlementId} not found`);
    }

    if (settlement.status !== 'PENDING') {
      throw new BadRequestException('Cannot add links to non-pending settlement');
    }

    // Verify parties exist
    const [fromParty, toParty] = await Promise.all([
      this.prisma.party.findUnique({ where: { id: createLinkDto.fromPartyId } }),
      this.prisma.party.findUnique({ where: { id: createLinkDto.toPartyId } }),
    ]);

    if (!fromParty || !toParty) {
      throw new BadRequestException('Invalid party IDs');
    }

    // Validate link type rules
    this.validateLinkType(createLinkDto.linkType, createLinkDto);

    // Determine sequence
    const maxSequence = settlement.links.reduce(
      (max, link) => Math.max(max, link.sequence),
      -1,
    );

    // Create link
    const link = await this.prisma.settlementLink.create({
      data: {
        settlementId,
        sequence: maxSequence + 1,
        ...createLinkDto,
        status: 'PENDING',
      },
      include: {
        fromParty: true,
        toParty: true,
      },
    });

    // Update settlement total
    await this.updateSettlementTotal(settlementId);

    return this.contracts.transform(SettlementLinkSchema, link);
  }

  async findAll(filters?: {
    status?: string;
    shipmentId?: string;
    chainId?: string;
  }): Promise<Settlement[]> {
    const settlements = await this.prisma.settlement.findMany({
      where: {
        ...(filters?.status && { status: filters.status }),
        ...(filters?.shipmentId && { shipmentId: filters.shipmentId }),
        ...(filters?.chainId && { chainId: filters.chainId }),
      },
      include: {
        links: {
          include: {
            fromParty: true,
            toParty: true,
          },
          orderBy: { sequence: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return settlements.map(s => this.contracts.transform(SettlementSchema, s));
  }

  async findOne(id: string): Promise<Settlement> {
    const settlement = await this.prisma.settlement.findUnique({
      where: { id },
      include: {
        shipment: {
          include: {
            order: true,
            carrier: true,
          },
        },
        links: {
          include: {
            fromParty: true,
            toParty: true,
          },
          orderBy: { sequence: 'asc' },
        },
      },
    });

    if (!settlement) {
      throw new NotFoundException(`Settlement ${id} not found`);
    }

    return this.contracts.transform(SettlementSchema, settlement);
  }

  async process(id: string): Promise<Settlement> {
    const settlement = await this.findOne(id);

    if (settlement.status !== 'PENDING') {
      throw new BadRequestException('Only pending settlements can be processed');
    }

    if (settlement.links.length === 0) {
      throw new BadRequestException('Settlement must have at least one link');
    }

    // Execute before hook
    const hookResult = await this.hooks.executeHook(
      Hooks.BEFORE_SETTLEMENT_PROCESS,
      { settlementId: id },
    );

    if (!hookResult.continue) {
      throw new BadRequestException(hookResult.error || 'Settlement processing blocked by plugin');
    }

    // Update status
    const updated = await this.prisma.settlement.update({
      where: { id },
      data: { status: 'PROCESSING' },
    });

    // Execute after hook
    await this.hooks.executeHook(Hooks.AFTER_SETTLEMENT_PROCESS, updated);

    // Emit event
    await this.eventBus.emitDomainEvent<SettlementEventData>(
      EventTypes.SETTLEMENT_PROCESSING,
      {
        settlementId: updated.id,
        settlementNumber: updated.settlementNumber,
        chainId: updated.chainId,
        shipmentId: updated.shipmentId,
        status: updated.status,
        totalAmount: {
          amount: updated.totalAmount,
          currency: updated.totalCurrency,
        },
        linkCount: settlement.links.length,
      },
      { subject: updated.id },
    );

    // Process each link (in real implementation, this would trigger payment processing)
    await this.processLinks(id);

    return this.findOne(id);
  }

  async complete(id: string): Promise<Settlement> {
    const settlement = await this.findOne(id);

    if (settlement.status !== 'PROCESSING') {
      throw new BadRequestException('Only processing settlements can be completed');
    }

    // Check all links are paid
    const unpaidLinks = settlement.links.filter(l => l.status !== 'PAID');
    if (unpaidLinks.length > 0) {
      throw new BadRequestException('All links must be paid before completing settlement');
    }

    // Update status
    const updated = await this.prisma.settlement.update({
      where: { id },
      data: { status: 'COMPLETED' },
    });

    // Emit event
    await this.eventBus.emitDomainEvent<SettlementEventData>(
      EventTypes.SETTLEMENT_COMPLETED,
      {
        settlementId: updated.id,
        settlementNumber: updated.settlementNumber,
        chainId: updated.chainId,
        shipmentId: updated.shipmentId,
        status: updated.status,
        totalAmount: {
          amount: updated.totalAmount,
          currency: updated.totalCurrency,
        },
        linkCount: settlement.links.length,
      },
      { subject: updated.id },
    );

    return this.findOne(id);
  }

  async markLinkPaid(settlementId: string, linkId: string): Promise<SettlementLink> {
    const link = await this.prisma.settlementLink.findFirst({
      where: {
        id: linkId,
        settlementId,
      },
    });

    if (!link) {
      throw new NotFoundException('Settlement link not found');
    }

    if (link.status === 'PAID') {
      throw new BadRequestException('Link is already paid');
    }

    const updated = await this.prisma.settlementLink.update({
      where: { id: linkId },
      data: {
        status: 'PAID',
        paidAt: new Date(),
      },
      include: {
        fromParty: true,
        toParty: true,
      },
    });

    return this.contracts.transform(SettlementLinkSchema, updated);
  }

  private async updateSettlementTotal(settlementId: string): Promise<void> {
    const links = await this.prisma.settlementLink.findMany({
      where: { settlementId },
    });

    // Calculate total based on DIRECT links only
    // PASS_THROUGH and SHARE links don't add to total
    const total = links
      .filter(l => l.linkType === 'DIRECT')
      .reduce((sum, link) => sum + link.amount, 0);

    await this.prisma.settlement.update({
      where: { id: settlementId },
      data: { totalAmount: total },
    });
  }

  private async processLinks(settlementId: string): Promise<void> {
    const links = await this.prisma.settlementLink.findMany({
      where: { settlementId },
      orderBy: { sequence: 'asc' },
    });

    // In a real implementation, this would integrate with payment systems
    // For now, we'll simulate processing
    for (const link of links) {
      // Simulate payment processing delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Mark as paid
      await this.prisma.settlementLink.update({
        where: { id: link.id },
        data: {
          status: 'PAID',
          paidAt: new Date(),
        },
      });
    }
  }

  private validateLinkType(
    linkType: string,
    linkData: CreateSettlementLinkDto,
  ): void {
    switch (linkType) {
      case 'SHARE':
        if (!linkData.sharePercentage) {
          throw new BadRequestException('Share percentage is required for SHARE type links');
        }
        if (linkData.sharePercentage < 0 || linkData.sharePercentage > 100) {
          throw new BadRequestException('Share percentage must be between 0 and 100');
        }
        break;
      
      case 'PASS_THROUGH':
        // Pass-through links typically have the same amount flowing through
        break;
      
      case 'DIRECT':
        // Direct payment from one party to another
        break;
      
      default:
        throw new BadRequestException(`Invalid link type: ${linkType}`);
    }
  }

  private async generateSettlementNumber(): Promise<string> {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    const count = await this.prisma.settlement.count({
      where: {
        createdAt: {
          gte: new Date(date.setHours(0, 0, 0, 0)),
          lte: new Date(date.setHours(23, 59, 59, 999)),
        },
      },
    });
    
    const sequence = String(count + 1).padStart(4, '0');
    return `STL-${year}${month}${day}-${sequence}`;
  }
}
