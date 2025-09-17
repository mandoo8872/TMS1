import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { UpdateShipmentDto } from './dto/update-shipment.dto';

@Injectable()
export class ShipmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createDto: CreateShipmentDto) {
    // Verify order exists
    const order = await this.prisma.order.findUnique({
      where: { id: createDto.orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order ${createDto.orderId} not found`);
    }

    // Generate shipment number
    const shipmentNumber = await this.generateShipmentNumber();

    // Create shipment
    const shipment = await this.prisma.shipment.create({
      data: {
        shipmentNumber,
        orderId: createDto.orderId,
        status: createDto.status || 'PLANNED',
        assignedCarrierId: createDto.assignedCarrierId,
        assignedDriverId: createDto.assignedDriverId,
        metadata: createDto.metadata ? JSON.stringify(createDto.metadata) : null,
      },
    });

    // Create default stages
    await this.createDefaultStages(shipment.id, order);

    return this.findOne(shipment.id);
  }

  async findAll(filters?: {
    status?: string;
    orderId?: string;
    carrierId?: string;
    driverId?: string;
  }) {
    const shipments = await this.prisma.shipment.findMany({
      where: {
        ...(filters?.status && { status: filters.status }),
        ...(filters?.orderId && { orderId: filters.orderId }),
        ...(filters?.carrierId && { assignedCarrierId: filters.carrierId }),
        ...(filters?.driverId && { assignedDriverId: filters.driverId }),
      },
      include: {
        order: true,
        carrier: true,
        stages: {
          orderBy: { sequence: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return shipments.map(shipment => this.transformShipment(shipment));
  }

  async findOne(id: string) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            shipper: true,
            consignee: true,
            items: true,
          },
        },
        carrier: true,
        stages: {
          include: {
            dependencies: {
              include: {
                requiredStage: true,
              },
            },
          },
          orderBy: { sequence: 'asc' },
        },
      },
    });

    if (!shipment) {
      throw new NotFoundException(`Shipment ${id} not found`);
    }

    return this.transformShipment(shipment);
  }

  async update(id: string, updateDto: UpdateShipmentDto) {
    // Check shipment exists
    await this.findOne(id);

    // Update shipment
    const shipment = await this.prisma.shipment.update({
      where: { id },
      data: {
        ...(updateDto.status && { status: updateDto.status }),
        ...(updateDto.assignedCarrierId && { assignedCarrierId: updateDto.assignedCarrierId }),
        ...(updateDto.assignedDriverId && { assignedDriverId: updateDto.assignedDriverId }),
        ...(updateDto.actualPickupDate && { 
          actualPickupDate: new Date(updateDto.actualPickupDate) 
        }),
        ...(updateDto.actualDeliveryDate && { 
          actualDeliveryDate: new Date(updateDto.actualDeliveryDate) 
        }),
        ...(updateDto.metadata && { 
          metadata: JSON.stringify(updateDto.metadata) 
        }),
      },
    });

    return this.findOne(id);
  }

  async dispatch(id: string) {
    const shipment = await this.findOne(id);

    if (shipment.status !== 'PLANNED') {
      throw new BadRequestException('Shipment must be in PLANNED status to dispatch');
    }

    if (!shipment.assignedCarrierId) {
      throw new BadRequestException('Shipment must have an assigned carrier to dispatch');
    }

    const updated = await this.prisma.shipment.update({
      where: { id },
      data: { status: 'DISPATCHED' },
    });

    return this.findOne(id);
  }

  async deliver(id: string) {
    const shipment = await this.findOne(id);

    // Check all stages are completed
    const incompleteStages = shipment.stages.filter(
      (s: any) => s.status !== 'COMPLETED' && s.status !== 'SKIPPED'
    );

    if (incompleteStages.length > 0) {
      throw new BadRequestException(
        `Cannot deliver shipment with incomplete stages: ${incompleteStages.map((s: any) => s.stageType).join(', ')}`
      );
    }

    const updated = await this.prisma.shipment.update({
      where: { id },
      data: { 
        status: 'DELIVERED',
        actualDeliveryDate: new Date(),
      },
    });

    return this.findOne(id);
  }

  async advanceStage(shipmentId: string, stageId: string, force: boolean = false) {
    // Get stage
    const stage = await this.prisma.shipmentStage.findFirst({
      where: {
        id: stageId,
        shipmentId,
      },
      include: {
        dependencies: {
          include: {
            requiredStage: true,
          },
        },
      },
    });

    if (!stage) {
      throw new NotFoundException('Stage not found');
    }

    // Check dependencies unless force is true
    if (!force) {
      const blockedBy = stage.dependencies
        .filter((dep: any) => 
          dep.requiredStage.status !== 'COMPLETED' && 
          dep.requiredStage.status !== 'SKIPPED'
        )
        .map((dep: any) => dep.requiredStageId);

      if (blockedBy.length > 0) {
        return {
          success: false,
          stage: this.transformStage(stage),
          blockedBy,
          message: 'Stage blocked by dependencies',
        };
      }
    }

    // Determine next status
    const nextStatus = this.getNextStageStatus(stage.status);
    if (!nextStatus) {
      throw new BadRequestException(`Cannot advance stage from status ${stage.status}`);
    }

    // Update stage
    const updated = await this.prisma.shipmentStage.update({
      where: { id: stageId },
      data: {
        status: nextStatus,
        ...(nextStatus === 'IN_PROGRESS' && { actualStartTime: new Date() }),
        ...(nextStatus === 'COMPLETED' && { actualEndTime: new Date() }),
      },
    });

    // Update shipment current stage if needed
    if (nextStatus === 'IN_PROGRESS') {
      await this.prisma.shipment.update({
        where: { id: shipmentId },
        data: { currentStageId: updated.id },
      });
    }

    return {
      success: true,
      stage: this.transformStage(updated),
      message: `Stage ${stage.stageType} advanced to ${nextStatus}`,
    };
  }

  async getPipeline(shipmentId: string) {
    const stages = await this.prisma.shipmentStage.findMany({
      where: { shipmentId },
      include: {
        dependencies: {
          include: {
            requiredStage: true,
          },
        },
        dependents: {
          include: {
            dependentStage: true,
          },
        },
      },
      orderBy: { sequence: 'asc' },
    });

    return stages.map(stage => ({
      ...this.transformStage(stage),
      dependencies: stage.dependencies.map((dep: any) => dep.requiredStageId),
      dependents: stage.dependents.map((dep: any) => dep.dependentStageId),
    }));
  }

  private async createDefaultStages(shipmentId: string, order: any) {
    const stages = [
      {
        shipmentId,
        stageType: 'PICKUP',
        sequence: 0,
        status: 'PENDING',
        location: order.pickupLocation,
      },
      {
        shipmentId,
        stageType: 'TRANSIT',
        sequence: 1,
        status: 'PENDING',
      },
      {
        shipmentId,
        stageType: 'DELIVERY',
        sequence: 2,
        status: 'PENDING',
        location: order.deliveryLocation,
      },
    ];

    // Create stages
    const createdStages = await Promise.all(
      stages.map(stage => 
        this.prisma.shipmentStage.create({
          data: {
            ...stage,
            location: stage.location ? JSON.stringify(stage.location) : null,
          },
        })
      )
    );

    // Create dependencies (Transit depends on Pickup, Delivery depends on Transit)
    if (createdStages.length >= 3) {
      await this.prisma.stageDependency.createMany({
        data: [
          {
            dependentStageId: createdStages[1].id, // Transit
            requiredStageId: createdStages[0].id,  // Pickup
          },
          {
            dependentStageId: createdStages[2].id, // Delivery
            requiredStageId: createdStages[1].id,  // Transit
          },
        ],
      });
    }
  }

  private transformShipment(shipment: any) {
    return {
      ...shipment,
      metadata: this.parseJson(shipment.metadata),
      order: shipment.order ? {
        ...shipment.order,
        pickupLocation: this.parseJson(shipment.order.pickupLocation),
        deliveryLocation: this.parseJson(shipment.order.deliveryLocation),
        metadata: this.parseJson(shipment.order.metadata),
      } : shipment.order,
      stages: shipment.stages?.map((stage: any) => this.transformStage(stage)),
    };
  }

  private transformStage(stage: any) {
    return {
      ...stage,
      location: this.parseJson(stage.location),
      metadata: this.parseJson(stage.metadata),
    };
  }

  private parseJson(jsonString: string | null) {
    if (!jsonString) return null;
    try {
      return JSON.parse(jsonString);
    } catch {
      return jsonString;
    }
  }

  private getNextStageStatus(currentStatus: string): string | null {
    const transitions: Record<string, string> = {
      'PENDING': 'IN_PROGRESS',
      'IN_PROGRESS': 'COMPLETED',
    };
    return transitions[currentStatus] || null;
  }

  private async generateShipmentNumber(): Promise<string> {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    const count = await this.prisma.shipment.count({
      where: {
        createdAt: {
          gte: new Date(date.setHours(0, 0, 0, 0)),
          lte: new Date(date.setHours(23, 59, 59, 999)),
        },
      },
    });
    
    const sequence = String(count + 1).padStart(4, '0');
    return `SHP-${year}${month}${day}-${sequence}`;
  }
}
