import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { EventBusService } from '@/kernel/services/event-bus.service';
import { ContractService } from '@/kernel/services/contract.service';
import { HookService } from '@/kernel/services/hook.service';
import { 
  PartyRelation, 
  PartyRelationSchema,
  EventTypes,
  RelationEventData,
} from '@tms/contracts';
import { Hooks } from '@tms/plugin-sdk';
import { CreateRelationDto } from './dto/create-relation.dto';

@Injectable()
export class PartyRelationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly contracts: ContractService,
    private readonly hooks: HookService,
  ) {}

  async create(createDto: CreateRelationDto): Promise<PartyRelation> {
    // Validate contract
    const validated = this.contracts.validate(
      PartyRelationSchema.omit({ id: true }),
      createDto,
    );

    // Execute before hook
    const hookResult = await this.hooks.executeHook(
      Hooks.BEFORE_RELATION_CREATE,
      validated,
    );

    if (!hookResult.continue) {
      throw new BadRequestException(hookResult.error || 'Relation creation blocked by plugin');
    }

    const relationData = hookResult.data || validated;

    // Validate parties exist
    const [fromParty, toParty] = await Promise.all([
      this.prisma.party.findUnique({ where: { id: relationData.fromPartyId } }),
      this.prisma.party.findUnique({ where: { id: relationData.toPartyId } }),
    ]);

    if (!fromParty) {
      throw new NotFoundException(`From party ${relationData.fromPartyId} not found`);
    }
    if (!toParty) {
      throw new NotFoundException(`To party ${relationData.toPartyId} not found`);
    }

    // Validate relation type matches party types
    this.validateRelationType(relationData.relationType, fromParty.type, toParty.type);

    // Check for duplicate relation
    const existing = await this.prisma.partyRelation.findFirst({
      where: {
        fromPartyId: relationData.fromPartyId,
        toPartyId: relationData.toPartyId,
        relationType: relationData.relationType,
      },
    });

    if (existing) {
      throw new BadRequestException('Relation already exists');
    }

    // Create relation
    const relation = await this.prisma.partyRelation.create({
      data: relationData,
      include: {
        fromParty: true,
        toParty: true,
      },
    });

    // Execute after hook
    await this.hooks.executeHook(Hooks.AFTER_RELATION_CREATE, relation);

    // Emit event
    await this.eventBus.emitDomainEvent<RelationEventData>(
      EventTypes.RELATION_ESTABLISHED,
      {
        relationId: relation.id,
        fromPartyId: relation.fromPartyId,
        toPartyId: relation.toPartyId,
        relationType: relation.relationType,
        status: relation.status,
        tier: relation.tier,
      },
      { subject: relation.id },
    );

    return this.contracts.transform(PartyRelationSchema, relation);
  }

  async findAll(filters?: {
    fromPartyId?: string;
    toPartyId?: string;
    relationType?: string;
    status?: string;
    tier?: number;
  }): Promise<PartyRelation[]> {
    const relations = await this.prisma.partyRelation.findMany({
      where: {
        ...(filters?.fromPartyId && { fromPartyId: filters.fromPartyId }),
        ...(filters?.toPartyId && { toPartyId: filters.toPartyId }),
        ...(filters?.relationType && { relationType: filters.relationType }),
        ...(filters?.status && { status: filters.status }),
        ...(filters?.tier !== undefined && { tier: filters.tier }),
      },
      include: {
        fromParty: true,
        toParty: true,
      },
      orderBy: [{ tier: 'asc' }, { createdAt: 'desc' }],
    });

    return relations.map(r => this.contracts.transform(PartyRelationSchema, r));
  }

  async findOne(id: string): Promise<PartyRelation> {
    const relation = await this.prisma.partyRelation.findUnique({
      where: { id },
      include: {
        fromParty: true,
        toParty: true,
      },
    });

    if (!relation) {
      throw new NotFoundException(`Relation ${id} not found`);
    }

    return this.contracts.transform(PartyRelationSchema, relation);
  }

  async updateStatus(id: string, status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'): Promise<PartyRelation> {
    const relation = await this.prisma.partyRelation.update({
      where: { id },
      data: { status },
      include: {
        fromParty: true,
        toParty: true,
      },
    });

    // Emit event
    await this.eventBus.emitDomainEvent<RelationEventData>(
      EventTypes.RELATION_UPDATED,
      {
        relationId: relation.id,
        fromPartyId: relation.fromPartyId,
        toPartyId: relation.toPartyId,
        relationType: relation.relationType,
        status: relation.status,
        tier: relation.tier,
      },
      { subject: relation.id },
    );

    return this.contracts.transform(PartyRelationSchema, relation);
  }

  async terminate(id: string): Promise<void> {
    const relation = await this.findOne(id);

    await this.prisma.partyRelation.update({
      where: { id },
      data: { 
        status: 'INACTIVE',
        validTo: new Date(),
      },
    });

    // Emit event
    await this.eventBus.emitDomainEvent<RelationEventData>(
      EventTypes.RELATION_TERMINATED,
      {
        relationId: relation.id,
        fromPartyId: relation.fromPartyId,
        toPartyId: relation.toPartyId,
        relationType: relation.relationType,
        status: 'INACTIVE',
        tier: relation.tier,
      },
      { subject: relation.id },
    );
  }

  private validateRelationType(
    relationType: string,
    fromType: string,
    toType: string,
  ): void {
    const validCombinations: Record<string, [string, string]> = {
      'BROKER_CARRIER': ['BROKER', 'CARRIER'],
      'CARRIER_DRIVER': ['CARRIER', 'DRIVER'],
      'SHIPPER_BROKER': ['SHIPPER', 'BROKER'],
    };

    const expected = validCombinations[relationType];
    if (!expected) {
      throw new BadRequestException(`Invalid relation type: ${relationType}`);
    }

    if (fromType !== expected[0] || toType !== expected[1]) {
      throw new BadRequestException(
        `Invalid party types for ${relationType}: expected ${expected[0]} -> ${expected[1]}, got ${fromType} -> ${toType}`,
      );
    }
  }
}
