import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { CreateSettlementDto } from './dto/create-settlement.dto';
import { CreateSettlementLinkDto } from './dto/create-settlement-link.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class SettlementsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createDto: CreateSettlementDto) {
    // Verify shipment exists
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: createDto.shipmentId },
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
      throw new NotFoundException(`Shipment ${createDto.shipmentId} not found`);
    }

    // Generate settlement number
    const settlementNumber = await this.generateSettlementNumber();

    // Create settlement
    const settlement = await this.prisma.settlement.create({
      data: {
        settlementNumber,
        chainId: createDto.chainId,
        shipmentId: createDto.shipmentId,
        status: createDto.status || 'PENDING',
        totalAmount: 0, // Will be calculated after links are added
        totalCurrency: 'USD',
        metadata: createDto.metadata ? JSON.stringify(createDto.metadata) : null,
      },
    });

    return this.transformSettlement(settlement);
  }

  async addLink(settlementId: string, createLinkDto: CreateSettlementLinkDto) {
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
        fromPartyId: createLinkDto.fromPartyId,
        toPartyId: createLinkDto.toPartyId,
        linkType: createLinkDto.linkType,
        amount: createLinkDto.amount,
        currency: createLinkDto.currency,
        sharePercentage: createLinkDto.sharePercentage,
        status: 'PENDING',
        metadata: createLinkDto.metadata ? JSON.stringify(createLinkDto.metadata) : null,
      },
      include: {
        fromParty: true,
        toParty: true,
      },
    });

    // Update settlement total
    await this.updateSettlementTotal(settlementId);

    return this.transformLink(link);
  }

  async findAll(filters?: {
    status?: string;
    shipmentId?: string;
    chainId?: string;
  }) {
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

    return settlements.map(settlement => this.transformSettlement(settlement));
  }

  async findOne(id: string) {
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

    return this.transformSettlement(settlement);
  }

  async getSettlementChain(chainId: string, includeDetails: boolean = false) {
    const settlements = await this.prisma.settlement.findMany({
      where: { chainId },
      include: {
        links: {
          include: {
            fromParty: true,
            toParty: true,
          },
          orderBy: { sequence: 'asc' },
        },
        shipment: {
          include: {
            order: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (settlements.length === 0) {
      throw new NotFoundException(`No settlements found for chain ${chainId}`);
    }

    // Calculate totals
    const totalLinks = settlements.reduce((sum, s) => sum + s.links.length, 0);
    const totalAmount = settlements.reduce((sum, s) => sum + s.totalAmount, 0);

    // Transform settlements
    const transformedSettlements = includeDetails
      ? settlements.map(s => this.transformSettlement(s))
      : settlements.map(s => ({
          id: s.id,
          settlementNumber: s.settlementNumber,
          status: s.status,
          totalAmount: { amount: s.totalAmount, currency: s.totalCurrency },
        }));

    return {
      chainId,
      settlements: transformedSettlements,
      totalLinks,
      totalAmount: {
        amount: totalAmount,
        currency: 'USD',
      },
    };
  }

  async createChain(shipmentIds: string[], chainMetadata?: Record<string, any>) {
    const chainId = uuidv4();

    // Verify all shipments exist
    const shipments = await this.prisma.shipment.findMany({
      where: { id: { in: shipmentIds } },
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

    if (shipments.length !== shipmentIds.length) {
      throw new NotFoundException('One or more shipments not found');
    }

    // Create settlements for each shipment
    const settlements = await Promise.all(
      shipments.map(async (shipment) => {
        const settlementNumber = await this.generateSettlementNumber();
        
        return this.prisma.settlement.create({
          data: {
            settlementNumber,
            chainId,
            shipmentId: shipment.id,
            status: 'PENDING',
            totalAmount: 0,
            totalCurrency: 'USD',
            metadata: chainMetadata ? JSON.stringify({
              ...chainMetadata,
              shipmentNumber: shipment.shipmentNumber,
              orderNumber: shipment.order.orderNumber,
            }) : null,
          },
        });
      }),
    );

    return { chainId, settlements: settlements.length };
  }

  async process(id: string) {
    const settlement = await this.findOne(id);

    if (settlement.status !== 'PENDING') {
      throw new BadRequestException('Only pending settlements can be processed');
    }

    if (settlement.links.length === 0) {
      throw new BadRequestException('Settlement must have at least one link');
    }

    // Update status
    const updated = await this.prisma.settlement.update({
      where: { id },
      data: { status: 'PROCESSING' },
    });

    // Process each link (simulate payment processing)
    await this.processLinks(id);

    return this.findOne(id);
  }

  private async processLinks(settlementId: string) {
    const links = await this.prisma.settlementLink.findMany({
      where: { settlementId },
      orderBy: { sequence: 'asc' },
    });

    // Simulate payment processing
    for (const link of links) {
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await this.prisma.settlementLink.update({
        where: { id: link.id },
        data: {
          status: 'PAID',
          paidAt: new Date(),
        },
      });
    }
  }

  private async updateSettlementTotal(settlementId: string) {
    const links = await this.prisma.settlementLink.findMany({
      where: { settlementId },
    });

    // Calculate total based on DIRECT links only
    const total = links
      .filter(l => l.linkType === 'DIRECT')
      .reduce((sum, link) => sum + link.amount, 0);

    await this.prisma.settlement.update({
      where: { id: settlementId },
      data: { totalAmount: total },
    });
  }

  private transformSettlement(settlement: any) {
    return {
      ...settlement,
      metadata: this.parseJson(settlement.metadata),
      totalAmount: {
        amount: settlement.totalAmount,
        currency: settlement.totalCurrency,
      },
      links: settlement.links?.map((link: any) => this.transformLink(link)),
    };
  }

  private transformLink(link: any) {
    return {
      ...link,
      metadata: this.parseJson(link.metadata),
      amount: {
        amount: link.amount,
        currency: link.currency,
      },
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
