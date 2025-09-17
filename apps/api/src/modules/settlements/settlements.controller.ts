import { 
  Controller, 
  Get, 
  Post, 
  Patch,
  Param, 
  Body, 
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { 
  Settlement,
  SettlementLink,
  SettlementChainRequest,
  SettlementChainResponse,
} from '@tms/contracts';
import { SettlementsService } from './settlements.service';
import { SettlementChainService } from './settlement-chain.service';
import { CreateSettlementDto } from './dto/create-settlement.dto';
import { CreateSettlementLinkDto } from './dto/create-settlement-link.dto';

@ApiTags('settlements')
@Controller('settlements')
export class SettlementsController {
  constructor(
    private readonly settlementsService: SettlementsService,
    private readonly chainService: SettlementChainService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new settlement' })
  async create(@Body() createDto: CreateSettlementDto): Promise<Settlement> {
    return this.settlementsService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all settlements' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'shipmentId', required: false })
  @ApiQuery({ name: 'chainId', required: false })
  async findAll(
    @Query('status') status?: string,
    @Query('shipmentId') shipmentId?: string,
    @Query('chainId') chainId?: string,
  ): Promise<Settlement[]> {
    return this.settlementsService.findAll({
      status,
      shipmentId,
      chainId,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get settlement by ID' })
  async findOne(@Param('id') id: string): Promise<Settlement> {
    return this.settlementsService.findOne(id);
  }

  @Post(':id/links')
  @ApiOperation({ summary: 'Add link to settlement' })
  async addLink(
    @Param('id') id: string,
    @Body() createLinkDto: CreateSettlementLinkDto,
  ): Promise<SettlementLink> {
    return this.settlementsService.addLink(id, createLinkDto);
  }

  @Patch(':id/process')
  @ApiOperation({ summary: 'Process settlement' })
  async process(@Param('id') id: string): Promise<Settlement> {
    return this.settlementsService.process(id);
  }

  @Patch(':id/complete')
  @ApiOperation({ summary: 'Complete settlement' })
  async complete(@Param('id') id: string): Promise<Settlement> {
    return this.settlementsService.complete(id);
  }

  @Patch(':id/links/:linkId/paid')
  @ApiOperation({ summary: 'Mark settlement link as paid' })
  async markLinkPaid(
    @Param('id') id: string,
    @Param('linkId') linkId: string,
  ): Promise<SettlementLink> {
    return this.settlementsService.markLinkPaid(id, linkId);
  }

  // Settlement Chain endpoints
  @Get('chain/:chainId')
  @ApiOperation({ summary: 'Get settlement chain' })
  @ApiQuery({ name: 'includeDetails', required: false, type: Boolean })
  async getSettlementChain(
    @Param('chainId') chainId: string,
    @Query('includeDetails') includeDetails?: string,
  ): Promise<SettlementChainResponse> {
    const request: SettlementChainRequest = {
      chainId,
      includeDetails: includeDetails === 'true',
    };
    return this.chainService.getSettlementChain(request);
  }

  @Post('chain')
  @ApiOperation({ summary: 'Create settlement chain' })
  async createChain(
    @Body() body: { shipmentIds: string[]; metadata?: Record<string, any> },
  ): Promise<{ chainId: string }> {
    const chainId = await this.chainService.createSettlementChain(
      body.shipmentIds,
      body.metadata,
    );
    return { chainId };
  }

  @Get('chain/:chainId/analyze')
  @ApiOperation({ summary: 'Analyze settlement chain' })
  async analyzeChain(@Param('chainId') chainId: string) {
    return this.chainService.analyzeChain(chainId);
  }

  @Get('chain/:chainId/validate')
  @ApiOperation({ summary: 'Validate settlement chain' })
  async validateChain(@Param('chainId') chainId: string) {
    return this.chainService.validateChain(chainId);
  }

  @Get('chain/:chainId/net-positions')
  @ApiOperation({ summary: 'Calculate net positions for all parties in chain' })
  async getNetPositions(@Param('chainId') chainId: string) {
    const positions = await this.chainService.calculateNetPositions(chainId);
    return {
      chainId,
      positions: Array.from(positions.entries()).map(([partyId, amount]) => ({
        partyId,
        netAmount: amount,
        currency: 'USD',
      })),
    };
  }
}
