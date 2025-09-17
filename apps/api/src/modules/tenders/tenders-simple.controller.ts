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
import { TendersService } from './tenders-simple.service';
import { CreateTenderDto } from './dto/create-tender.dto';
import { UpdateTenderDto } from './dto/update-tender.dto';
import { SubmitOfferDto } from './dto/submit-offer.dto';

@ApiTags('tenders')
@Controller('tenders')
export class TendersController {
  constructor(private readonly tendersService: TendersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new tender' })
  async create(@Body() createDto: CreateTenderDto) {
    return this.tendersService.create(createDto);
  }

  @Post('cascade')
  @ApiOperation({ summary: 'Create cascade tenders across multiple tiers' })
  async createCascade(
    @Body() request: {
      orderId: string;
      mode: 'SEQUENTIAL' | 'PARALLEL';
      tiers: Array<{
        tier: number;
        carrierIds: string[];
        offerDeadlineMinutes: number;
      }>;
    },
    @Query('brokerId') brokerId: string,
  ) {
    return this.tendersService.createCascade(brokerId, request);
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
  ) {
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
  async findOne(@Param('id') id: string) {
    return this.tendersService.findOne(id);
  }

  @Patch(':id/award')
  @ApiOperation({ summary: 'Award tender to an offer' })
  async award(
    @Param('id') id: string,
    @Body('offerId') offerId: string,
  ) {
    return this.tendersService.awardTender(id, offerId);
  }

  // Offer endpoints
  @Get(':id/offers')
  @ApiOperation({ summary: 'Get all offers for a tender' })
  async getOffers(@Param('id') id: string) {
    return this.tendersService.getOffers(id);
  }

  @Post(':id/offers')
  @ApiOperation({ summary: 'Submit offer for a tender' })
  async submitOffer(
    @Param('id') id: string,
    @Body() submitDto: SubmitOfferDto,
    @Query('carrierId') carrierId: string,
  ) {
    return this.tendersService.submitOffer(id, carrierId, submitDto);
  }
}
