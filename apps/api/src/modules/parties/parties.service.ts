import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { EventBusService } from '@/kernel/services/event-bus.service';
import { ContractService } from '@/kernel/services/contract.service';
import { HookService } from '@/kernel/services/hook.service';
import { 
  Party, 
  PartySchema, 
  EventTypes,
  PartyEventData,
} from '@tms/contracts';
import { Hooks } from '@tms/plugin-sdk';
import { CreatePartyDto } from './dto/create-party.dto';
import { UpdatePartyDto } from './dto/update-party.dto';

@Injectable()
export class PartiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly contracts: ContractService,
    private readonly hooks: HookService,
  ) {}

  async create(createDto: CreatePartyDto): Promise<Party> {
    // Validate contract
    const validated = this.contracts.validate(PartySchema.omit({ 
      id: true, 
      createdAt: true, 
      updatedAt: true 
    }), createDto);

    // Execute before hook
    const hookResult = await this.hooks.executeHook(
      Hooks.BEFORE_PARTY_CREATE,
      validated,
    );

    if (!hookResult.continue) {
      throw new BadRequestException(hookResult.error || 'Party creation blocked by plugin');
    }

    const partyData = hookResult.data || validated;

    // Check for duplicate code
    const existing = await this.prisma.party.findUnique({
      where: { code: partyData.code },
    });

    if (existing) {
      throw new BadRequestException(`Party with code ${partyData.code} already exists`);
    }

    // Create party
    const party = await this.prisma.party.create({
      data: partyData,
    });

    // Execute after hook
    await this.hooks.executeHook(Hooks.AFTER_PARTY_CREATE, party);

    // Emit event
    await this.eventBus.emitDomainEvent<PartyEventData>(
      EventTypes.PARTY_CREATED,
      {
        partyId: party.id,
        partyType: party.type,
        name: party.name,
        code: party.code,
        active: party.active,
      },
      { subject: party.id },
    );

    return this.contracts.transform(PartySchema, party);
  }

  async findAll(filters?: {
    type?: string;
    active?: boolean;
  }): Promise<Party[]> {
    const parties = await this.prisma.party.findMany({
      where: {
        ...(filters?.type && { type: filters.type }),
        ...(filters?.active !== undefined && { active: filters.active }),
      },
      orderBy: { name: 'asc' },
    });

    return parties.map(p => this.contracts.transform(PartySchema, p));
  }

  async findOne(id: string): Promise<Party> {
    const party = await this.prisma.party.findUnique({
      where: { id },
    });

    if (!party) {
      throw new NotFoundException(`Party ${id} not found`);
    }

    return this.contracts.transform(PartySchema, party);
  }

  async findByCode(code: string): Promise<Party> {
    const party = await this.prisma.party.findUnique({
      where: { code },
    });

    if (!party) {
      throw new NotFoundException(`Party with code ${code} not found`);
    }

    return this.contracts.transform(PartySchema, party);
  }

  async update(id: string, updateDto: UpdatePartyDto): Promise<Party> {
    // Check party exists
    await this.findOne(id);

    // Validate contract
    const validated = this.contracts.validate(
      PartySchema.partial().omit({ 
        id: true, 
        createdAt: true, 
        updatedAt: true 
      }), 
      updateDto,
    );

    // Check code uniqueness if updating
    if (validated.code) {
      const existing = await this.prisma.party.findFirst({
        where: { 
          code: validated.code,
          NOT: { id },
        },
      });

      if (existing) {
        throw new BadRequestException(`Party with code ${validated.code} already exists`);
      }
    }

    // Update party
    const party = await this.prisma.party.update({
      where: { id },
      data: validated,
    });

    // Emit event
    await this.eventBus.emitDomainEvent<PartyEventData>(
      EventTypes.PARTY_UPDATED,
      {
        partyId: party.id,
        partyType: party.type,
        name: party.name,
        code: party.code,
        active: party.active,
      },
      { subject: party.id },
    );

    return this.contracts.transform(PartySchema, party);
  }

  async activate(id: string): Promise<Party> {
    const party = await this.prisma.party.update({
      where: { id },
      data: { active: true },
    });

    // Emit event
    await this.eventBus.emitDomainEvent<PartyEventData>(
      EventTypes.PARTY_ACTIVATED,
      {
        partyId: party.id,
        partyType: party.type,
        name: party.name,
        code: party.code,
        active: party.active,
      },
      { subject: party.id },
    );

    return this.contracts.transform(PartySchema, party);
  }

  async deactivate(id: string): Promise<Party> {
    const party = await this.prisma.party.update({
      where: { id },
      data: { active: false },
    });

    // Emit event
    await this.eventBus.emitDomainEvent<PartyEventData>(
      EventTypes.PARTY_DEACTIVATED,
      {
        partyId: party.id,
        partyType: party.type,
        name: party.name,
        code: party.code,
        active: party.active,
      },
      { subject: party.id },
    );

    return this.contracts.transform(PartySchema, party);
  }
}
