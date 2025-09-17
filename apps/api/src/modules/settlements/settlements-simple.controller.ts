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
import { SettlementsService } from './settlements-simple.service';
import { CreateSettlementDto } from './dto/create-settlement.dto';
import { CreateSettlementLinkDto } from './dto/create-settlement-link.dto';

@ApiTags('settlements')
@Controller('settlements')
export class SettlementsController {
  constructor(private readonly settlementsService: SettlementsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new settlement' })
  async create(@Body() createDto: CreateSettlementDto) {
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
  ) {
    return this.settlementsService.findAll({
      status,
      shipmentId,
      chainId,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get settlement by ID' })
  async findOne(@Param('id') id: string) {
    return this.settlementsService.findOne(id);
  }

  @Post(':id/links')
  @ApiOperation({ summary: 'Add link to settlement' })
  async addLink(
    @Param('id') id: string,
    @Body() createLinkDto: CreateSettlementLinkDto,
  ) {
    return this.settlementsService.addLink(id, createLinkDto);
  }

  @Patch(':id/process')
  @ApiOperation({ summary: 'Process settlement' })
  async process(@Param('id') id: string) {
    return this.settlementsService.process(id);
  }

  // Settlement Chain endpoints
  @Get('chain/:chainId')
  @ApiOperation({ summary: 'Get settlement chain' })
  @ApiQuery({ name: 'includeDetails', required: false, type: Boolean })
  async getSettlementChain(
    @Param('chainId') chainId: string,
    @Query('includeDetails') includeDetails?: string,
  ) {
    return this.settlementsService.getSettlementChain(
      chainId,
      includeDetails === 'true'
    );
  }

  @Post('chain')
  @ApiOperation({ summary: 'Create settlement chain' })
  async createChain(
    @Body() body: { shipmentIds: string[]; metadata?: Record<string, any> },
  ) {
    const result = await this.settlementsService.createChain(
      body.shipmentIds,
      body.metadata,
    );
    return result;
  }
}
