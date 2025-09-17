import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { EventBusService } from '@/kernel/services/event-bus.service';
import { ContractService } from '@/kernel/services/contract.service';
import { HookService } from '@/kernel/services/hook.service';
import { 
  Shipment, 
  ShipmentSchema, 
  EventTypes,
  ShipmentEventData,
} from '@tms/contracts';
import { Hooks } from '@tms/plugin-sdk';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { UpdateShipmentDto } from './dto/update-shipment.dto';
import { StagesService } from './stages.service';

@Injectable()
export class ShipmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly contracts: ContractService,
    private readonly hooks: HookService,
    private readonly stagesService: StagesService,
  ) {}

  async create(createDto: CreateShipmentDto): Promise<Shipment> {
    // Validate contract
    const validated = this.contracts.validate(
      ShipmentSchema.omit({ 
        id: true,
        shipmentNumber: true,
        stages: true,
        createdAt: true, 
        updatedAt: true 
      }), 
      createDto,
    );

    // Execute before hook
    const hookResult = await this.hooks.executeHook(
      Hooks.BEFORE_SHIPMENT_CREATE,
      validated,
    );

    if (!hookResult.continue) {
      throw new BadRequestException(hookResult.error || 'Shipment creation blocked by plugin');
    }

    const shipmentData = hookResult.data || validated;

    // Verify order exists
    const order = await this.prisma.order.findUnique({
      where: { id: shipmentData.orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order ${shipmentData.orderId} not found`);
    }

    // Generate shipment number
    const shipmentNumber = await this.generateShipmentNumber();

    // Create shipment with default stages
    const shipment = await this.prisma.shipment.create({
      data: {
        ...shipmentData,
        shipmentNumber,
      },
    });

    // Create default stages based on order
    await this.stagesService.createDefaultStages(shipment.id, order);

    // Fetch complete shipment
    const completeShipment = await this.findOne(shipment.id);

    // Execute after hook
    await this.hooks.executeHook(Hooks.AFTER_SHIPMENT_CREATE, completeShipment);

    // Emit event
    await this.eventBus.emitDomainEvent<ShipmentEventData>(
      EventTypes.SHIPMENT_CREATED,
      {
        shipmentId: shipment.id,
        shipmentNumber: shipment.shipmentNumber,
        orderId: shipment.orderId,
        status: shipment.status,
        carrierId: shipment.assignedCarrierId,
        driverId: shipment.assignedDriverId,
      },
      { subject: shipment.id },
    );

    return completeShipment;
  }

  async findAll(filters?: {
    status?: string;
    orderId?: string;
    carrierId?: string;
    driverId?: string;
  }): Promise<Shipment[]> {
    const shipments = await this.prisma.shipment.findMany({
      where: {
        ...(filters?.status && { status: filters.status }),
        ...(filters?.orderId && { orderId: filters.orderId }),
        ...(filters?.carrierId && { assignedCarrierId: filters.carrierId }),
        ...(filters?.driverId && { assignedDriverId: filters.driverId }),
      },
      include: {
        order: true,
        stages: {
          orderBy: { sequence: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return shipments.map(s => this.contracts.transform(ShipmentSchema, {
      ...s,
      stages: s.stages.map(stage => ({
        ...stage,
        dependencies: [], // Will be populated by stage service if needed
      })),
    }));
  }

  async findOne(id: string): Promise<Shipment> {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            shipper: true,
            consignee: true,
          },
        },
        carrier: true,
        stages: {
          orderBy: { sequence: 'asc' },
        },
      },
    });

    if (!shipment) {
      throw new NotFoundException(`Shipment ${id} not found`);
    }

    // Get stage dependencies
    const stages = await Promise.all(
      shipment.stages.map(async (stage) => {
        const dependencies = await this.stagesService.getStageDependencies(stage.id);
        return {
          ...stage,
          dependencies,
        };
      }),
    );

    return this.contracts.transform(ShipmentSchema, {
      ...shipment,
      stages,
    });
  }

  async update(id: string, updateDto: UpdateShipmentDto): Promise<Shipment> {
    // Check shipment exists
    await this.findOne(id);

    // Validate contract
    const validated = this.contracts.validate(
      ShipmentSchema.partial().omit({ 
        id: true,
        shipmentNumber: true,
        orderId: true,
        stages: true,
        createdAt: true, 
        updatedAt: true 
      }), 
      updateDto,
    );

    // Update shipment
    const shipment = await this.prisma.shipment.update({
      where: { id },
      data: validated,
    });

    const completeShipment = await this.findOne(id);

    // Emit event
    await this.eventBus.emitDomainEvent<ShipmentEventData>(
      EventTypes.SHIPMENT_UPDATED,
      {
        shipmentId: shipment.id,
        shipmentNumber: shipment.shipmentNumber,
        orderId: shipment.orderId,
        status: shipment.status,
        carrierId: shipment.assignedCarrierId,
        driverId: shipment.assignedDriverId,
      },
      { subject: shipment.id },
    );

    return completeShipment;
  }

  async dispatch(id: string): Promise<Shipment> {
    const shipment = await this.findOne(id);

    if (shipment.status !== 'PLANNED') {
      throw new BadRequestException('Shipment must be in PLANNED status to dispatch');
    }

    if (!shipment.assignedCarrierId) {
      throw new BadRequestException('Shipment must have an assigned carrier to dispatch');
    }

    // Execute before hook
    const hookResult = await this.hooks.executeHook(
      Hooks.BEFORE_SHIPMENT_DISPATCH,
      { shipmentId: id },
    );

    if (!hookResult.continue) {
      throw new BadRequestException(hookResult.error || 'Shipment dispatch blocked by plugin');
    }

    // Update status
    const updated = await this.prisma.shipment.update({
      where: { id },
      data: { status: 'DISPATCHED' },
    });

    const completeShipment = await this.findOne(id);

    // Execute after hook
    await this.hooks.executeHook(Hooks.AFTER_SHIPMENT_DISPATCH, completeShipment);

    // Emit event
    await this.eventBus.emitDomainEvent<ShipmentEventData>(
      EventTypes.SHIPMENT_DISPATCHED,
      {
        shipmentId: updated.id,
        shipmentNumber: updated.shipmentNumber,
        orderId: updated.orderId,
        status: updated.status,
        carrierId: updated.assignedCarrierId,
        driverId: updated.assignedDriverId,
      },
      { subject: updated.id },
    );

    return completeShipment;
  }

  async deliver(id: string): Promise<Shipment> {
    const shipment = await this.findOne(id);

    // Check all stages are completed
    const incompleteStages = shipment.stages.filter(
      s => s.status !== 'COMPLETED' && s.status !== 'SKIPPED'
    );

    if (incompleteStages.length > 0) {
      throw new BadRequestException(
        `Cannot deliver shipment with incomplete stages: ${incompleteStages.map(s => s.stageType).join(', ')}`
      );
    }

    // Execute before hook
    const hookResult = await this.hooks.executeHook(
      Hooks.BEFORE_SHIPMENT_DELIVER,
      { shipmentId: id },
    );

    if (!hookResult.continue) {
      throw new BadRequestException(hookResult.error || 'Shipment delivery blocked by plugin');
    }

    // Update status
    const updated = await this.prisma.shipment.update({
      where: { id },
      data: { 
        status: 'DELIVERED',
        actualDeliveryDate: new Date(),
      },
    });

    const completeShipment = await this.findOne(id);

    // Execute after hook
    await this.hooks.executeHook(Hooks.AFTER_SHIPMENT_DELIVER, completeShipment);

    // Emit event
    await this.eventBus.emitDomainEvent<ShipmentEventData>(
      EventTypes.SHIPMENT_DELIVERED,
      {
        shipmentId: updated.id,
        shipmentNumber: updated.shipmentNumber,
        orderId: updated.orderId,
        status: updated.status,
        carrierId: updated.assignedCarrierId,
        driverId: updated.assignedDriverId,
      },
      { subject: updated.id },
    );

    return completeShipment;
  }

  async cancel(id: string): Promise<Shipment> {
    const updated = await this.prisma.shipment.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    const completeShipment = await this.findOne(id);

    // Emit event
    await this.eventBus.emitDomainEvent<ShipmentEventData>(
      EventTypes.SHIPMENT_CANCELLED,
      {
        shipmentId: updated.id,
        shipmentNumber: updated.shipmentNumber,
        orderId: updated.orderId,
        status: updated.status,
        carrierId: updated.assignedCarrierId,
        driverId: updated.assignedDriverId,
      },
      { subject: updated.id },
    );

    return completeShipment;
  }

  private async generateShipmentNumber(): Promise<string> {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    // Get today's shipment count
    const startOfDay = new Date(date.setHours(0, 0, 0, 0));
    const endOfDay = new Date(date.setHours(23, 59, 59, 999));
    
    const count = await this.prisma.shipment.count({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });
    
    const sequence = String(count + 1).padStart(4, '0');
    return `SHP-${year}${month}${day}-${sequence}`;
  }
}
