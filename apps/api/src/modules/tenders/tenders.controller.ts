import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Patch,
  Param, 
  Body, 
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { 
  Tender,
  TenderOffer,
  CascadeTenderRequest,
} from '@tms/contracts';
import { TendersService } from './tenders.service';
import { TenderOffersService } from './tender-offers.service';
import { CascadeTenderService } from './cascade-tender.service';
import { CreateTenderDto } from './dto/create-tender.dto';
import { UpdateTenderDto } from './dto/update-tender.dto';
import { SubmitOfferDto } from './dto/submit-offer.dto';

@ApiTags('tenders')
@Controller('tenders')
export class TendersController {
  constructor(
    private readonly tendersService: TendersService,
    private readonly offersService: TenderOffersService,
    private readonly cascadeService: CascadeTenderService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new tender' })
  async create(@Body() createDto: CreateTenderDto): Promise<Tender> {
    return this.tendersService.create(createDto);
  }

  @Post('cascade')
  @ApiOperation({ summary: 'Create cascade tenders across multiple tiers' })
  async createCascade(
    @Body() request: CascadeTenderRequest,
    @Query('brokerId') brokerId: string,
  ) {
    return this.cascadeService.createCascadeTenders(brokerId, request);
  }

  @Get()
  @ApiOperation({ summary: 'Get all tenders' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'orderId', required: false })
  @ApiQuery({ name: 'shipmentId', required: false })
  @ApiQuery({ name: 'mode', required: false })
  @ApiQuery({ name: 'tier', required: false, type: Number })
  async findAll(
    @Query('status') status?: string,
    @Query('orderId') orderId?: string,
    @Query('shipmentId') shipmentId?: string,
    @Query('mode') mode?: string,
    @Query('tier') tier?: string,
  ): Promise<Tender[]> {
    return this.tendersService.findAll({
      status,
      orderId,
      shipmentId,
      mode,
      tier: tier ? parseInt(tier, 10) : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get tender by ID' })
  async findOne(@Param('id') id: string): Promise<Tender> {
    return this.tendersService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update tender' })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateTenderDto,
  ): Promise<Tender> {
    return this.tendersService.update(id, updateDto);
  }

  @Patch(':id/open')
  @ApiOperation({ summary: 'Open tender for offers' })
  async open(@Param('id') id: string): Promise<Tender> {
    return this.tendersService.open(id);
  }

  @Patch(':id/close')
  @ApiOperation({ summary: 'Close tender for offers' })
  async close(@Param('id') id: string): Promise<Tender> {
    return this.tendersService.close(id);
  }

  @Patch(':id/award')
  @ApiOperation({ summary: 'Award tender to an offer' })
  async award(
    @Param('id') id: string,
    @Body('offerId') offerId: string,
  ): Promise<Tender> {
    return this.tendersService.award(id, offerId);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel tender' })
  async cancel(@Param('id') id: string): Promise<Tender> {
    return this.tendersService.cancel(id);
  }

  // Offer endpoints
  @Get(':id/offers')
  @ApiOperation({ summary: 'Get all offers for a tender' })
  async getOffers(@Param('id') id: string): Promise<TenderOffer[]> {
    return this.offersService.getOffers(id);
  }

  @Post(':id/offers')
  @ApiOperation({ summary: 'Submit offer for a tender' })
  async submitOffer(
    @Param('id') id: string,
    @Body() submitDto: SubmitOfferDto,
    @Query('carrierId') carrierId: string,
  ): Promise<TenderOffer> {
    return this.offersService.submitOffer(id, carrierId, submitDto);
  }

  @Patch(':id/offers/withdraw')
  @ApiOperation({ summary: 'Withdraw offer from tender' })
  async withdrawOffer(
    @Param('id') id: string,
    @Query('carrierId') carrierId: string,
  ): Promise<TenderOffer> {
    return this.offersService.withdrawOffer(id, carrierId);
  }

  @Get('offers/carrier/:carrierId')
  @ApiOperation({ summary: 'Get all offers for a carrier' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'tenderId', required: false })
  async getCarrierOffers(
    @Param('carrierId') carrierId: string,
    @Query('status') status?: string,
    @Query('tenderId') tenderId?: string,
  ): Promise<TenderOffer[]> {
    return this.offersService.getCarrierOffers(carrierId, {
      status,
      tenderId,
    });
  }

  @Patch('offers/:offerId/accept')
  @ApiOperation({ summary: 'Accept an offer' })
  async acceptOffer(@Param('offerId') offerId: string): Promise<TenderOffer> {
    return this.offersService.acceptOffer(offerId);
  }

  @Patch('offers/:offerId/reject')
  @ApiOperation({ summary: 'Reject an offer' })
  async rejectOffer(@Param('offerId') offerId: string): Promise<TenderOffer> {
    return this.offersService.rejectOffer(offerId);
  }
}
