import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { CreatePartyDto } from './dto/create-party.dto';
import { UpdatePartyDto } from './dto/update-party.dto';
import { CreateRelationDto } from './dto/create-relation.dto';

@Injectable()
export class PartiesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createDto: CreatePartyDto) {
    // Check for duplicate code
    const existing = await this.prisma.party.findUnique({
      where: { code: createDto.code },
    });

    if (existing) {
      throw new BadRequestException(`Party with code ${createDto.code} already exists`);
    }

    // Create party
    const party = await this.prisma.party.create({
      data: {
        type: createDto.type,
        name: createDto.name,
        code: createDto.code,
        active: createDto.active ?? true,
        metadata: createDto.metadata ? JSON.stringify(createDto.metadata) : null,
      },
    });

    return this.transformParty(party);
  }

  async findAll(filters?: {
    type?: string;
    active?: boolean;
  }) {
    const parties = await this.prisma.party.findMany({
      where: {
        ...(filters?.type && { type: filters.type }),
        ...(filters?.active !== undefined && { active: filters.active }),
      },
      orderBy: { name: 'asc' },
    });

    return parties.map(party => this.transformParty(party));
  }

  async findOne(id: string) {
    const party = await this.prisma.party.findUnique({
      where: { id },
    });

    if (!party) {
      throw new NotFoundException(`Party ${id} not found`);
    }

    return this.transformParty(party);
  }

  async update(id: string, updateDto: UpdatePartyDto) {
    // Check party exists
    await this.findOne(id);

    // Check code uniqueness if updating
    if (updateDto.code) {
      const existing = await this.prisma.party.findFirst({
        where: { 
          code: updateDto.code,
          NOT: { id },
        },
      });

      if (existing) {
        throw new BadRequestException(`Party with code ${updateDto.code} already exists`);
      }
    }

    // Update party
    const party = await this.prisma.party.update({
      where: { id },
      data: {
        ...(updateDto.name && { name: updateDto.name }),
        ...(updateDto.code && { code: updateDto.code }),
        ...(updateDto.active !== undefined && { active: updateDto.active }),
        ...(updateDto.metadata && { metadata: JSON.stringify(updateDto.metadata) }),
      },
    });

    return this.transformParty(party);
  }

  async createRelation(createDto: CreateRelationDto) {
    // Validate parties exist
    const [fromParty, toParty] = await Promise.all([
      this.prisma.party.findUnique({ where: { id: createDto.fromPartyId } }),
      this.prisma.party.findUnique({ where: { id: createDto.toPartyId } }),
    ]);

    if (!fromParty) {
      throw new NotFoundException(`From party ${createDto.fromPartyId} not found`);
    }
    if (!toParty) {
      throw new NotFoundException(`To party ${createDto.toPartyId} not found`);
    }

    // Validate relation type matches party types
    this.validateRelationType(createDto.relationType, fromParty.type, toParty.type);

    // Check for duplicate relation
    const existing = await this.prisma.partyRelation.findFirst({
      where: {
        fromPartyId: createDto.fromPartyId,
        toPartyId: createDto.toPartyId,
        relationType: createDto.relationType,
      },
    });

    if (existing) {
      throw new BadRequestException('Relation already exists');
    }

    // Create relation
    const relation = await this.prisma.partyRelation.create({
      data: {
        fromPartyId: createDto.fromPartyId,
        toPartyId: createDto.toPartyId,
        relationType: createDto.relationType,
        status: createDto.status || 'ACTIVE',
        tier: createDto.tier,
        validFrom: new Date(createDto.validFrom),
        validTo: createDto.validTo ? new Date(createDto.validTo) : null,
        metadata: createDto.metadata ? JSON.stringify(createDto.metadata) : null,
      },
      include: {
        fromParty: true,
        toParty: true,
      },
    });

    return this.transformRelation(relation);
  }

  async getCarriersByTier(brokerId: string) {
    // Get all carrier relations for the broker
    const relations = await this.prisma.partyRelation.findMany({
      where: {
        fromPartyId: brokerId,
        relationType: 'BROKER_CARRIER',
        status: 'ACTIVE',
      },
      include: {
        toParty: true,
      },
      orderBy: { tier: 'asc' },
    });

    // Group by tier
    const tierMap = new Map<number, any[]>();
    
    for (const relation of relations) {
      const tier = relation.tier;
      if (!tierMap.has(tier)) {
        tierMap.set(tier, []);
      }
      tierMap.get(tier)!.push(this.transformParty(relation.toParty));
    }

    // Convert to array
    return Array.from(tierMap.entries())
      .map(([tier, carriers]) => ({ tier, carriers }))
      .sort((a, b) => a.tier - b.tier);
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

  private transformParty(party: any) {
    return {
      ...party,
      metadata: this.parseJson(party.metadata),
    };
  }

  private transformRelation(relation: any) {
    return {
      ...relation,
      metadata: this.parseJson(relation.metadata),
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
}
