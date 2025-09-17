import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { EventBusService } from '@/kernel/services/event-bus.service';
import { ContractService } from '@/kernel/services/contract.service';
import { HookService } from '@/kernel/services/hook.service';
import { 
  Tender, 
  TenderSchema, 
  EventTypes,
  TenderEventData,
} from '@tms/contracts';
import { Hooks } from '@tms/plugin-sdk';
import { CreateTenderDto } from './dto/create-tender.dto';
import { UpdateTenderDto } from './dto/update-tender.dto';

@Injectable()
export class TendersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly contracts: ContractService,
    private readonly hooks: HookService,
  ) {}

  async create(createDto: CreateTenderDto): Promise<Tender> {
    // Validate contract
    const validated = this.contracts.validate(
      TenderSchema.omit({ 
        id: true,
        tenderNumber: true,
        offers: true,
        createdAt: true, 
        updatedAt: true 
      }), 
      createDto,
    );

    // Execute before hook
    const hookResult = await this.hooks.executeHook(
      Hooks.BEFORE_TENDER_CREATE,
      validated,
    );

    if (!hookResult.continue) {
      throw new BadRequestException(hookResult.error || 'Tender creation blocked by plugin');
    }

    const tenderData = hookResult.data || validated;

    // Verify order exists
    const order = await this.prisma.order.findUnique({
      where: { id: tenderData.orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order ${tenderData.orderId} not found`);
    }

    // Generate tender number
    const tenderNumber = await this.generateTenderNumber();

    // Create tender
    const tender = await this.prisma.tender.create({
      data: {
        ...tenderData,
        tenderNumber,
      },
      include: {
        offers: true,
        parentTender: true,
        childTenders: true,
      },
    });

    // Execute after hook
    await this.hooks.executeHook(Hooks.AFTER_TENDER_CREATE, tender);

    // Emit event
    await this.eventBus.emitDomainEvent<TenderEventData>(
      EventTypes.TENDER_CREATED,
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

    return this.contracts.transform(TenderSchema, tender);
  }

  async findAll(filters?: {
    status?: string;
    orderId?: string;
    shipmentId?: string;
    mode?: string;
    tier?: number;
  }): Promise<Tender[]> {
    const tenders = await this.prisma.tender.findMany({
      where: {
        ...(filters?.status && { status: filters.status }),
        ...(filters?.orderId && { orderId: filters.orderId }),
        ...(filters?.shipmentId && { shipmentId: filters.shipmentId }),
        ...(filters?.mode && { mode: filters.mode }),
        ...(filters?.tier !== undefined && { tier: filters.tier }),
      },
      include: {
        offers: {
          include: { carrier: true },
        },
        parentTender: true,
        childTenders: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return tenders.map(t => this.contracts.transform(TenderSchema, t));
  }

  async findOne(id: string): Promise<Tender> {
    const tender = await this.prisma.tender.findUnique({
      where: { id },
      include: {
        order: true,
        shipment: true,
        offers: {
          include: { carrier: true },
        },
        parentTender: true,
        childTenders: {
          include: {
            offers: true,
          },
        },
      },
    });

    if (!tender) {
      throw new NotFoundException(`Tender ${id} not found`);
    }

    return this.contracts.transform(TenderSchema, tender);
  }

  async update(id: string, updateDto: UpdateTenderDto): Promise<Tender> {
    // Check tender exists
    await this.findOne(id);

    // Validate contract
    const validated = this.contracts.validate(
      TenderSchema.partial().omit({ 
        id: true,
        tenderNumber: true,
        orderId: true,
        offers: true,
        createdAt: true, 
        updatedAt: true 
      }), 
      updateDto,
    );

    // Update tender
    const tender = await this.prisma.tender.update({
      where: { id },
      data: validated,
      include: {
        offers: {
          include: { carrier: true },
        },
      },
    });

    // Emit event
    await this.eventBus.emitDomainEvent<TenderEventData>(
      EventTypes.TENDER_UPDATED,
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

    return this.contracts.transform(TenderSchema, tender);
  }

  async open(id: string): Promise<Tender> {
    const tender = await this.findOne(id);

    if (tender.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT tenders can be opened');
    }

    const updated = await this.prisma.tender.update({
      where: { id },
      data: { status: 'OPEN' },
      include: {
        offers: {
          include: { carrier: true },
        },
      },
    });

    // Emit event
    await this.eventBus.emitDomainEvent<TenderEventData>(
      EventTypes.TENDER_OPENED,
      {
        tenderId: updated.id,
        tenderNumber: updated.tenderNumber,
        orderId: updated.orderId,
        shipmentId: updated.shipmentId,
        status: updated.status,
        mode: updated.mode,
        tier: updated.tier,
        parentTenderId: updated.parentTenderId,
      },
      { subject: updated.id },
    );

    return this.contracts.transform(TenderSchema, updated);
  }

  async close(id: string): Promise<Tender> {
    const tender = await this.findOne(id);

    if (tender.status !== 'OPEN') {
      throw new BadRequestException('Only OPEN tenders can be closed');
    }

    const updated = await this.prisma.tender.update({
      where: { id },
      data: { status: 'CLOSED' },
      include: {
        offers: {
          include: { carrier: true },
        },
      },
    });

    // Emit event
    await this.eventBus.emitDomainEvent<TenderEventData>(
      EventTypes.TENDER_CLOSED,
      {
        tenderId: updated.id,
        tenderNumber: updated.tenderNumber,
        orderId: updated.orderId,
        shipmentId: updated.shipmentId,
        status: updated.status,
        mode: updated.mode,
        tier: updated.tier,
        parentTenderId: updated.parentTenderId,
      },
      { subject: updated.id },
    );

    return this.contracts.transform(TenderSchema, updated);
  }

  async award(id: string, offerId: string): Promise<Tender> {
    const tender = await this.findOne(id);

    if (tender.status !== 'CLOSED') {
      throw new BadRequestException('Only CLOSED tenders can be awarded');
    }

    // Verify offer exists and belongs to this tender
    const offer = tender.offers.find(o => o.id === offerId);
    if (!offer) {
      throw new NotFoundException('Offer not found in this tender');
    }

    if (offer.status !== 'SUBMITTED') {
      throw new BadRequestException('Only SUBMITTED offers can be accepted');
    }

    // Execute before hook
    const hookResult = await this.hooks.executeHook(
      Hooks.BEFORE_TENDER_AWARD,
      { tenderId: id, offerId },
    );

    if (!hookResult.continue) {
      throw new BadRequestException(hookResult.error || 'Tender award blocked by plugin');
    }

    // Update tender and offer in transaction
    const [updatedTender] = await this.prisma.$transaction([
      this.prisma.tender.update({
        where: { id },
        data: { status: 'AWARDED' },
        include: {
          offers: {
            include: { carrier: true },
          },
        },
      }),
      this.prisma.tenderOffer.update({
        where: { id: offerId },
        data: { status: 'ACCEPTED' },
      }),
      // Reject other offers
      this.prisma.tenderOffer.updateMany({
        where: {
          tenderId: id,
          id: { not: offerId },
          status: 'SUBMITTED',
        },
        data: { status: 'REJECTED' },
      }),
    ]);

    // If tender has a shipment, assign the carrier
    if (tender.shipmentId) {
      await this.prisma.shipment.update({
        where: { id: tender.shipmentId },
        data: { assignedCarrierId: offer.carrierId },
      });
    }

    // Execute after hook
    await this.hooks.executeHook(Hooks.AFTER_TENDER_AWARD, {
      tender: updatedTender,
      acceptedOffer: offer,
    });

    // Emit event
    await this.eventBus.emitDomainEvent<TenderEventData>(
      EventTypes.TENDER_AWARDED,
      {
        tenderId: updatedTender.id,
        tenderNumber: updatedTender.tenderNumber,
        orderId: updatedTender.orderId,
        shipmentId: updatedTender.shipmentId,
        status: updatedTender.status,
        mode: updatedTender.mode,
        tier: updatedTender.tier,
        parentTenderId: updatedTender.parentTenderId,
      },
      { subject: updatedTender.id },
    );

    return this.contracts.transform(TenderSchema, updatedTender);
  }

  async cancel(id: string): Promise<Tender> {
    const updated = await this.prisma.tender.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: {
        offers: {
          include: { carrier: true },
        },
      },
    });

    // Emit event
    await this.eventBus.emitDomainEvent<TenderEventData>(
      EventTypes.TENDER_CANCELLED,
      {
        tenderId: updated.id,
        tenderNumber: updated.tenderNumber,
        orderId: updated.orderId,
        shipmentId: updated.shipmentId,
        status: updated.status,
        mode: updated.mode,
        tier: updated.tier,
        parentTenderId: updated.parentTenderId,
      },
      { subject: updated.id },
    );

    return this.contracts.transform(TenderSchema, updated);
  }

  private async generateTenderNumber(): Promise<string> {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    // Get today's tender count
    const startOfDay = new Date(date.setHours(0, 0, 0, 0));
    const endOfDay = new Date(date.setHours(23, 59, 59, 999));
    
    const count = await this.prisma.tender.count({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });
    
    const sequence = String(count + 1).padStart(4, '0');
    return `TND-${year}${month}${day}-${sequence}`;
  }
}
