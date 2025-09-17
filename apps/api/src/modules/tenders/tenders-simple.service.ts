import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { CreateTenderDto } from './dto/create-tender.dto';
import { UpdateTenderDto } from './dto/update-tender.dto';
import { SubmitOfferDto } from './dto/submit-offer.dto';

@Injectable()
export class TendersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createDto: CreateTenderDto) {
    // Verify order exists
    const order = await this.prisma.order.findUnique({
      where: { id: createDto.orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order ${createDto.orderId} not found`);
    }

    // Generate tender number
    const tenderNumber = await this.generateTenderNumber();

    // Create tender
    const tender = await this.prisma.tender.create({
      data: {
        tenderNumber,
        orderId: createDto.orderId,
        shipmentId: createDto.shipmentId,
        status: createDto.status || 'DRAFT',
        mode: createDto.mode,
        tier: createDto.tier,
        parentTenderId: createDto.parentTenderId,
        offerDeadline: new Date(createDto.offerDeadline),
        metadata: createDto.metadata ? JSON.stringify(createDto.metadata) : null,
      },
      include: {
        offers: true,
        parentTender: true,
        childTenders: true,
      },
    });

    return this.transformTender(tender);
  }

  async findAll(filters?: {
    status?: string;
    orderId?: string;
    shipmentId?: string;
    mode?: string;
    tier?: number;
  }) {
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

    return tenders.map(tender => this.transformTender(tender));
  }

  async findOne(id: string) {
    const tender = await this.prisma.tender.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            shipper: true,
            consignee: true,
          },
        },
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

    return this.transformTender(tender);
  }

  async createCascade(brokerId: string, request: {
    orderId: string;
    mode: 'SEQUENTIAL' | 'PARALLEL';
    tiers: Array<{
      tier: number;
      carrierIds: string[];
      offerDeadlineMinutes: number;
    }>;
  }) {
    // Verify order exists
    const order = await this.prisma.order.findUnique({
      where: { id: request.orderId },
    });

    if (!order) {
      throw new BadRequestException(`Order ${request.orderId} not found`);
    }

    // Get available carriers for broker
    const carrierRelations = await this.prisma.partyRelation.findMany({
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

    const createdTenders = [];
    let parentTenderId: string | undefined;

    // Create tenders for each tier
    for (const tierConfig of request.tiers) {
      const carriersAtTier = carrierRelations.filter(rel => rel.tier === tierConfig.tier);
      
      if (carriersAtTier.length === 0) continue;

      // Filter carriers based on request
      const selectedCarriers = tierConfig.carrierIds.length > 0
        ? carriersAtTier.filter(rel => tierConfig.carrierIds.includes(rel.toPartyId))
        : carriersAtTier;

      if (selectedCarriers.length === 0) continue;

      // Calculate offer deadline
      const offerDeadline = new Date();
      offerDeadline.setMinutes(offerDeadline.getMinutes() + tierConfig.offerDeadlineMinutes);

      // Create tender
      const tender = await this.prisma.tender.create({
        data: {
          tenderNumber: await this.generateTenderNumber(),
          orderId: order.id,
          status: tierConfig.tier === 0 || request.mode === 'PARALLEL' ? 'OPEN' : 'DRAFT',
          mode: request.mode,
          tier: tierConfig.tier,
          parentTenderId,
          offerDeadline,
        },
      });

      // Create pending offers for carriers
      await this.prisma.tenderOffer.createMany({
        data: selectedCarriers.map(rel => ({
          tenderId: tender.id,
          carrierId: rel.toPartyId,
          status: 'PENDING',
          priceAmount: 0,
          priceCurrency: 'USD',
          validUntil: offerDeadline,
          conditions: null,
        })),
      });

      const completeTender = await this.findOne(tender.id);
      createdTenders.push(completeTender);
      
      if (tierConfig.tier === 0) {
        parentTenderId = tender.id;
      }
    }

    return {
      rootTenderId: createdTenders[0]?.id,
      createdTenders,
      totalTiers: createdTenders.length,
    };
  }

  async submitOffer(tenderId: string, carrierId: string, submitDto: SubmitOfferDto) {
    // Check tender exists and is open
    const tender = await this.prisma.tender.findUnique({
      where: { id: tenderId },
    });

    if (!tender) {
      throw new NotFoundException(`Tender ${tenderId} not found`);
    }

    if (tender.status !== 'OPEN') {
      throw new BadRequestException('Tender is not open for offers');
    }

    if (new Date() > tender.offerDeadline) {
      throw new BadRequestException('Tender offer deadline has passed');
    }

    // Check if carrier has a pending offer
    const existingOffer = await this.prisma.tenderOffer.findFirst({
      where: {
        tenderId,
        carrierId,
      },
    });

    if (!existingOffer) {
      throw new BadRequestException('Carrier is not invited to this tender');
    }

    if (existingOffer.status !== 'PENDING') {
      throw new BadRequestException('Offer has already been submitted');
    }

    // Update offer
    const offer = await this.prisma.tenderOffer.update({
      where: { id: existingOffer.id },
      data: {
        status: 'SUBMITTED',
        priceAmount: submitDto.priceAmount,
        priceCurrency: submitDto.priceCurrency,
        validUntil: new Date(submitDto.validUntil),
        conditions: submitDto.conditions ? JSON.stringify(submitDto.conditions) : null,
        submittedAt: new Date(),
        metadata: submitDto.metadata ? JSON.stringify(submitDto.metadata) : null,
      },
      include: {
        tender: true,
        carrier: true,
      },
    });

    return this.transformOffer(offer);
  }

  async awardTender(id: string, offerId: string) {
    const tender = await this.findOne(id);

    if (tender.status !== 'CLOSED') {
      throw new BadRequestException('Only CLOSED tenders can be awarded');
    }

    // Verify offer exists and belongs to this tender
    const offer = tender.offers.find((o: any) => o.id === offerId);
    if (!offer) {
      throw new NotFoundException('Offer not found in this tender');
    }

    if (offer.status !== 'SUBMITTED') {
      throw new BadRequestException('Only SUBMITTED offers can be accepted');
    }

    // Update tender and offer in transaction
    await this.prisma.$transaction([
      this.prisma.tender.update({
        where: { id },
        data: { status: 'AWARDED' },
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

    return this.findOne(id);
  }

  async getOffers(tenderId: string) {
    const offers = await this.prisma.tenderOffer.findMany({
      where: { tenderId },
      include: {
        carrier: true,
      },
      orderBy: [
        { status: 'asc' },
        { priceAmount: 'asc' },
      ],
    });

    return offers.map(offer => this.transformOffer(offer));
  }

  private transformTender(tender: any) {
    return {
      ...tender,
      metadata: this.parseJson(tender.metadata),
      offers: tender.offers?.map((offer: any) => this.transformOffer(offer)),
    };
  }

  private transformOffer(offer: any) {
    return {
      ...offer,
      conditions: this.parseJson(offer.conditions),
      metadata: this.parseJson(offer.metadata),
      price: {
        amount: offer.priceAmount,
        currency: offer.priceCurrency,
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

  private async generateTenderNumber(): Promise<string> {
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
