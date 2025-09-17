import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { EventBusService } from '@/kernel/services/event-bus.service';
import { ContractService } from '@/kernel/services/contract.service';
import { HookService } from '@/kernel/services/hook.service';
import { 
  ShipmentStage,
  ShipmentStageSchema,
  StageAdvanceRequest,
  StageAdvanceResponse,
  EventTypes,
  StageEventData,
} from '@tms/contracts';
import { Hooks } from '@tms/plugin-sdk';
import { StagePipelineService } from './stage-pipeline.service';

@Injectable()
export class StagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly contracts: ContractService,
    private readonly hooks: HookService,
    private readonly pipeline: StagePipelineService,
  ) {}

  /**
   * Create default stages for a shipment based on order details
   */
  async createDefaultStages(shipmentId: string, order: any): Promise<void> {
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
    const createdStages = await this.prisma.shipmentStage.createMany({
      data: stages,
    });

    // Create dependencies (Transit depends on Pickup, Delivery depends on Transit)
    const stageRecords = await this.prisma.shipmentStage.findMany({
      where: { shipmentId },
      orderBy: { sequence: 'asc' },
    });

    if (stageRecords.length >= 3) {
      await this.prisma.stageDependency.createMany({
        data: [
          {
            dependentStageId: stageRecords[1].id, // Transit
            requiredStageId: stageRecords[0].id,  // Pickup
          },
          {
            dependentStageId: stageRecords[2].id, // Delivery
            requiredStageId: stageRecords[1].id,  // Transit
          },
        ],
      });
    }
  }

  /**
   * Get stage dependencies
   */
  async getStageDependencies(stageId: string): Promise<string[]> {
    const dependencies = await this.prisma.stageDependency.findMany({
      where: { dependentStageId: stageId },
      select: { requiredStageId: true },
    });

    return dependencies.map(d => d.requiredStageId);
  }

  /**
   * Advance stage to next status
   */
  async advanceStage(
    shipmentId: string,
    request: StageAdvanceRequest,
  ): Promise<StageAdvanceResponse> {
    // Validate request
    const validated = this.contracts.validate(StageAdvanceRequestSchema, request);

    // Get stage
    const stage = await this.prisma.shipmentStage.findFirst({
      where: {
        id: validated.stageId,
        shipmentId,
      },
    });

    if (!stage) {
      throw new NotFoundException('Stage not found');
    }

    // Check dependencies unless force is true
    if (!validated.force) {
      const blockedBy = await this.pipeline.checkDependencies(stage.id);
      if (blockedBy.length > 0) {
        return {
          success: false,
          stage: this.contracts.transform(ShipmentStageSchema, {
            ...stage,
            dependencies: await this.getStageDependencies(stage.id),
          }),
          blockedBy,
        };
      }
    }

    // Execute before hook
    const hookResult = await this.hooks.executeHook(
      Hooks.BEFORE_STAGE_ADVANCE,
      { stage, shipmentId },
    );

    if (!hookResult.continue) {
      throw new BadRequestException(hookResult.error || 'Stage advance blocked by plugin');
    }

    // Determine next status
    const nextStatus = this.getNextStatus(stage.status);
    if (!nextStatus) {
      throw new BadRequestException(`Cannot advance stage from status ${stage.status}`);
    }

    // Update stage
    const updated = await this.prisma.shipmentStage.update({
      where: { id: stage.id },
      data: {
        status: nextStatus,
        ...(nextStatus === 'IN_PROGRESS' && { actualStartTime: new Date() }),
        ...(nextStatus === 'COMPLETED' && { actualEndTime: new Date() }),
      },
    });

    // Execute after hook
    await this.hooks.executeHook(Hooks.AFTER_STAGE_ADVANCE, updated);

    // Emit appropriate event
    const eventType = this.getEventTypeForStatus(nextStatus);
    await this.eventBus.emitDomainEvent<StageEventData>(
      eventType,
      {
        stageId: updated.id,
        shipmentId: updated.shipmentId,
        stageType: updated.stageType,
        sequence: updated.sequence,
        status: updated.status,
      },
      { subject: `${shipmentId}.${updated.id}` },
    );

    // Update shipment current stage if needed
    if (nextStatus === 'IN_PROGRESS') {
      await this.prisma.shipment.update({
        where: { id: shipmentId },
        data: { currentStageId: updated.id },
      });
    }

    return {
      success: true,
      stage: this.contracts.transform(ShipmentStageSchema, {
        ...updated,
        dependencies: await this.getStageDependencies(updated.id),
      }),
    };
  }

  /**
   * Complete a stage
   */
  async completeStage(shipmentId: string, stageId: string): Promise<ShipmentStage> {
    const stage = await this.prisma.shipmentStage.findFirst({
      where: {
        id: stageId,
        shipmentId,
      },
    });

    if (!stage) {
      throw new NotFoundException('Stage not found');
    }

    if (stage.status !== 'IN_PROGRESS') {
      throw new BadRequestException('Stage must be IN_PROGRESS to complete');
    }

    // Execute before hook
    const hookResult = await this.hooks.executeHook(
      Hooks.BEFORE_STAGE_COMPLETE,
      { stage, shipmentId },
    );

    if (!hookResult.continue) {
      throw new BadRequestException(hookResult.error || 'Stage completion blocked by plugin');
    }

    const updated = await this.prisma.shipmentStage.update({
      where: { id: stageId },
      data: {
        status: 'COMPLETED',
        actualEndTime: new Date(),
      },
    });

    // Execute after hook
    await this.hooks.executeHook(Hooks.AFTER_STAGE_COMPLETE, updated);

    // Emit event
    await this.eventBus.emitDomainEvent<StageEventData>(
      EventTypes.STAGE_COMPLETED,
      {
        stageId: updated.id,
        shipmentId: updated.shipmentId,
        stageType: updated.stageType,
        sequence: updated.sequence,
        status: updated.status,
      },
      { subject: `${shipmentId}.${updated.id}` },
    );

    return this.contracts.transform(ShipmentStageSchema, {
      ...updated,
      dependencies: await this.getStageDependencies(updated.id),
    });
  }

  /**
   * Skip a stage
   */
  async skipStage(
    shipmentId: string,
    stageId: string,
    reason?: string,
  ): Promise<ShipmentStage> {
    const stage = await this.prisma.shipmentStage.findFirst({
      where: {
        id: stageId,
        shipmentId,
      },
    });

    if (!stage) {
      throw new NotFoundException('Stage not found');
    }

    if (stage.status !== 'PENDING') {
      throw new BadRequestException('Only PENDING stages can be skipped');
    }

    const updated = await this.prisma.shipmentStage.update({
      where: { id: stageId },
      data: {
        status: 'SKIPPED',
        metadata: {
          ...stage.metadata,
          skipReason: reason,
        },
      },
    });

    // Emit event
    await this.eventBus.emitDomainEvent<StageEventData>(
      EventTypes.STAGE_SKIPPED,
      {
        stageId: updated.id,
        shipmentId: updated.shipmentId,
        stageType: updated.stageType,
        sequence: updated.sequence,
        status: updated.status,
      },
      { subject: `${shipmentId}.${updated.id}` },
    );

    return this.contracts.transform(ShipmentStageSchema, {
      ...updated,
      dependencies: await this.getStageDependencies(updated.id),
    });
  }

  private getNextStatus(currentStatus: string): string | null {
    const transitions: Record<string, string> = {
      'PENDING': 'IN_PROGRESS',
      'IN_PROGRESS': 'COMPLETED',
    };
    return transitions[currentStatus] || null;
  }

  private getEventTypeForStatus(status: string): string {
    const eventMap: Record<string, string> = {
      'IN_PROGRESS': EventTypes.STAGE_STARTED,
      'COMPLETED': EventTypes.STAGE_COMPLETED,
      'FAILED': EventTypes.STAGE_FAILED,
      'SKIPPED': EventTypes.STAGE_SKIPPED,
    };
    return eventMap[status] || EventTypes.STAGE_STARTED;
  }
}
