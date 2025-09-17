import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Param, 
  Body, 
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { PartiesService } from './parties-simple.service';
import { CreatePartyDto } from './dto/create-party.dto';
import { UpdatePartyDto } from './dto/update-party.dto';
import { CreateRelationDto } from './dto/create-relation.dto';

@ApiTags('parties')
@Controller('parties')
export class PartiesController {
  constructor(private readonly partiesService: PartiesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new party' })
  async create(@Body() createDto: CreatePartyDto) {
    return this.partiesService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all parties' })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'active', required: false, type: Boolean })
  async findAll(
    @Query('type') type?: string,
    @Query('active') active?: string,
  ) {
    return this.partiesService.findAll({
      type,
      active: active === 'true' ? true : active === 'false' ? false : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get party by ID' })
  async findOne(@Param('id') id: string) {
    return this.partiesService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update party' })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdatePartyDto,
  ) {
    return this.partiesService.update(id, updateDto);
  }

  // Party Relations endpoints
  @Post('relations')
  @ApiOperation({ summary: 'Create party relation' })
  async createRelation(@Body() createDto: CreateRelationDto) {
    return this.partiesService.createRelation(createDto);
  }

  @Get(':id/carriers-by-tier')
  @ApiOperation({ summary: 'Get carriers organized by tier for a broker' })
  async getCarriersByTier(@Param('id') id: string) {
    return this.partiesService.getCarriersByTier(id);
  }
}
