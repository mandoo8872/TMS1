import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { EventBusService } from '@/kernel/services/event-bus.service';
import { ContractService } from '@/kernel/services/contract.service';
import { HookService } from '@/kernel/services/hook.service';
import { 
  TenderOffer, 
  TenderOfferSchema,
  EventTypes,
  OfferEventData,
} from '@tms/contracts';
import { Hooks } from '@tms/plugin-sdk';
import { SubmitOfferDto } from './dto/submit-offer.dto';

@Injectable()
export class TenderOffersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly contracts: ContractService,
    private readonly hooks: HookService,
  ) {}

  async submitOffer(
    tenderId: string,
    carrierId: string,
    submitDto: SubmitOfferDto,
  ): Promise<TenderOffer> {
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

    // Validate offer data
    const offerData = {
      ...submitDto,
      tenderId,
      carrierId,
      status: 'SUBMITTED',
    };

    // Execute before hook
    const hookResult = await this.hooks.executeHook(
      Hooks.BEFORE_OFFER_SUBMIT,
      offerData,
    );

    if (!hookResult.continue) {
      throw new BadRequestException(hookResult.error || 'Offer submission blocked by plugin');
    }

    const validatedData = hookResult.data || offerData;

    // Update offer
    const offer = await this.prisma.tenderOffer.update({
      where: { id: existingOffer.id },
      data: {
        status: 'SUBMITTED',
        priceAmount: validatedData.priceAmount,
        priceCurrency: validatedData.priceCurrency,
        validUntil: validatedData.validUntil,
        conditions: validatedData.conditions || [],
        submittedAt: new Date(),
        metadata: validatedData.metadata,
      },
      include: {
        tender: true,
        carrier: true,
      },
    });

    // Execute after hook
    await this.hooks.executeHook(Hooks.AFTER_OFFER_SUBMIT, offer);

    // Emit event
    await this.eventBus.emitDomainEvent<OfferEventData>(
      EventTypes.OFFER_SUBMITTED,
      {
        offerId: offer.id,
        tenderId: offer.tenderId,
        carrierId: offer.carrierId,
        price: {
          amount: offer.priceAmount,
          currency: offer.priceCurrency,
        },
        status: offer.status,
      },
      { subject: `${tenderId}.${offer.id}` },
    );

    return this.contracts.transform(TenderOfferSchema, offer);
  }

  async withdrawOffer(
    tenderId: string,
    carrierId: string,
  ): Promise<TenderOffer> {
    const offer = await this.prisma.tenderOffer.findFirst({
      where: {
        tenderId,
        carrierId,
        status: 'SUBMITTED',
      },
    });

    if (!offer) {
      throw new NotFoundException('No submitted offer found');
    }

    const updated = await this.prisma.tenderOffer.update({
      where: { id: offer.id },
      data: { status: 'WITHDRAWN' },
      include: {
        tender: true,
        carrier: true,
      },
    });

    // Emit event
    await this.eventBus.emitDomainEvent<OfferEventData>(
      EventTypes.OFFER_WITHDRAWN,
      {
        offerId: updated.id,
        tenderId: updated.tenderId,
        carrierId: updated.carrierId,
        price: {
          amount: updated.priceAmount,
          currency: updated.priceCurrency,
        },
        status: updated.status,
      },
      { subject: `${tenderId}.${updated.id}` },
    );

    return this.contracts.transform(TenderOfferSchema, updated);
  }

  async getOffers(tenderId: string): Promise<TenderOffer[]> {
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

    return offers.map(o => this.contracts.transform(TenderOfferSchema, o));
  }

  async getCarrierOffers(carrierId: string, filters?: {
    status?: string;
    tenderId?: string;
  }): Promise<TenderOffer[]> {
    const offers = await this.prisma.tenderOffer.findMany({
      where: {
        carrierId,
        ...(filters?.status && { status: filters.status }),
        ...(filters?.tenderId && { tenderId: filters.tenderId }),
      },
      include: {
        tender: {
          include: {
            order: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return offers.map(o => this.contracts.transform(TenderOfferSchema, o));
  }

  async acceptOffer(offerId: string): Promise<TenderOffer> {
    const offer = await this.prisma.tenderOffer.findUnique({
      where: { id: offerId },
      include: { tender: true },
    });

    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    if (offer.status !== 'SUBMITTED') {
      throw new BadRequestException('Only submitted offers can be accepted');
    }

    // Execute before hook
    const hookResult = await this.hooks.executeHook(
      Hooks.BEFORE_OFFER_ACCEPT,
      { offerId, tenderId: offer.tenderId },
    );

    if (!hookResult.continue) {
      throw new BadRequestException(hookResult.error || 'Offer acceptance blocked by plugin');
    }

    const updated = await this.prisma.tenderOffer.update({
      where: { id: offerId },
      data: { status: 'ACCEPTED' },
      include: {
        tender: true,
        carrier: true,
      },
    });

    // Execute after hook
    await this.hooks.executeHook(Hooks.AFTER_OFFER_ACCEPT, updated);

    // Emit event
    await this.eventBus.emitDomainEvent<OfferEventData>(
      EventTypes.OFFER_ACCEPTED,
      {
        offerId: updated.id,
        tenderId: updated.tenderId,
        carrierId: updated.carrierId,
        price: {
          amount: updated.priceAmount,
          currency: updated.priceCurrency,
        },
        status: updated.status,
      },
      { subject: `${updated.tenderId}.${updated.id}` },
    );

    return this.contracts.transform(TenderOfferSchema, updated);
  }

  async rejectOffer(offerId: string): Promise<TenderOffer> {
    const offer = await this.prisma.tenderOffer.findUnique({
      where: { id: offerId },
    });

    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    if (offer.status !== 'SUBMITTED') {
      throw new BadRequestException('Only submitted offers can be rejected');
    }

    const updated = await this.prisma.tenderOffer.update({
      where: { id: offerId },
      data: { status: 'REJECTED' },
      include: {
        tender: true,
        carrier: true,
      },
    });

    // Emit event
    await this.eventBus.emitDomainEvent<OfferEventData>(
      EventTypes.OFFER_REJECTED,
      {
        offerId: updated.id,
        tenderId: updated.tenderId,
        carrierId: updated.carrierId,
        price: {
          amount: updated.priceAmount,
          currency: updated.priceCurrency,
        },
        status: updated.status,
      },
      { subject: `${updated.tenderId}.${updated.id}` },
    );

    return this.contracts.transform(TenderOfferSchema, updated);
  }
}
