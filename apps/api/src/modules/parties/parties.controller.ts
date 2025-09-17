import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Patch,
  Param, 
  Body, 
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Party, PartyRelation } from '@tms/contracts';
import { PartiesService } from './parties.service';
import { PartyRelationsService } from './party-relations.service';
import { PartyGraphService } from './party-graph.service';
import { CreatePartyDto } from './dto/create-party.dto';
import { UpdatePartyDto } from './dto/update-party.dto';
import { CreateRelationDto } from './dto/create-relation.dto';

@ApiTags('parties')
@Controller('parties')
export class PartiesController {
  constructor(
    private readonly partiesService: PartiesService,
    private readonly relationsService: PartyRelationsService,
    private readonly graphService: PartyGraphService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new party' })
  async create(@Body() createDto: CreatePartyDto): Promise<Party> {
    return this.partiesService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all parties' })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'active', required: false, type: Boolean })
  async findAll(
    @Query('type') type?: string,
    @Query('active') active?: string,
  ): Promise<Party[]> {
    return this.partiesService.findAll({
      type,
      active: active === 'true' ? true : active === 'false' ? false : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get party by ID' })
  async findOne(@Param('id') id: string): Promise<Party> {
    return this.partiesService.findOne(id);
  }

  @Get('code/:code')
  @ApiOperation({ summary: 'Get party by code' })
  async findByCode(@Param('code') code: string): Promise<Party> {
    return this.partiesService.findByCode(code);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update party' })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdatePartyDto,
  ): Promise<Party> {
    return this.partiesService.update(id, updateDto);
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Activate party' })
  async activate(@Param('id') id: string): Promise<Party> {
    return this.partiesService.activate(id);
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate party' })
  async deactivate(@Param('id') id: string): Promise<Party> {
    return this.partiesService.deactivate(id);
  }

  // Party Relations endpoints
  @Post('relations')
  @ApiOperation({ summary: 'Create party relation' })
  async createRelation(@Body() createDto: CreateRelationDto): Promise<PartyRelation> {
    return this.relationsService.create(createDto);
  }

  @Get('relations')
  @ApiOperation({ summary: 'Get party relations' })
  @ApiQuery({ name: 'fromPartyId', required: false })
  @ApiQuery({ name: 'toPartyId', required: false })
  @ApiQuery({ name: 'relationType', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'tier', required: false, type: Number })
  async findRelations(
    @Query('fromPartyId') fromPartyId?: string,
    @Query('toPartyId') toPartyId?: string,
    @Query('relationType') relationType?: string,
    @Query('status') status?: string,
    @Query('tier') tier?: string,
  ): Promise<PartyRelation[]> {
    return this.relationsService.findAll({
      fromPartyId,
      toPartyId,
      relationType,
      status,
      tier: tier ? parseInt(tier, 10) : undefined,
    });
  }

  @Get('relations/:id')
  @ApiOperation({ summary: 'Get relation by ID' })
  async findRelation(@Param('id') id: string): Promise<PartyRelation> {
    return this.relationsService.findOne(id);
  }

  @Patch('relations/:id/status')
  @ApiOperation({ summary: 'Update relation status' })
  async updateRelationStatus(
    @Param('id') id: string,
    @Body('status') status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED',
  ): Promise<PartyRelation> {
    return this.relationsService.updateStatus(id, status);
  }

  @Patch('relations/:id/terminate')
  @ApiOperation({ summary: 'Terminate relation' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async terminateRelation(@Param('id') id: string): Promise<void> {
    return this.relationsService.terminate(id);
  }

  // Party Graph endpoints
  @Get(':id/graph')
  @ApiOperation({ summary: 'Get party relationship graph' })
  @ApiQuery({ name: 'direction', required: false, enum: ['downstream', 'upstream', 'both'] })
  @ApiQuery({ name: 'maxDepth', required: false, type: Number })
  async getPartyGraph(
    @Param('id') id: string,
    @Query('direction') direction?: 'downstream' | 'upstream' | 'both',
    @Query('maxDepth') maxDepth?: string,
  ) {
    return this.graphService.getPartyGraph(
      id,
      direction || 'downstream',
      maxDepth ? parseInt(maxDepth, 10) : 3,
    );
  }

  @Get(':id/carriers-by-tier')
  @ApiOperation({ summary: 'Get carriers organized by tier for a broker' })
  async getCarriersByTier(@Param('id') id: string) {
    return this.graphService.getCarriersByTier(id);
  }

  @Get(':fromId/paths/:toId')
  @ApiOperation({ summary: 'Find all paths between two parties' })
  @ApiQuery({ name: 'maxLength', required: false, type: Number })
  async findPaths(
    @Param('fromId') fromId: string,
    @Param('toId') toId: string,
    @Query('maxLength') maxLength?: string,
  ) {
    return this.graphService.findPaths(
      fromId,
      toId,
      maxLength ? parseInt(maxLength, 10) : 5,
    );
  }

  @Get(':id/network')
  @ApiOperation({ summary: 'Get all parties in the same network' })
  async getNetworkParties(@Param('id') id: string) {
    return this.graphService.getNetworkParties(id);
  }

  @Get(':fromId/connected/:toId')
  @ApiOperation({ summary: 'Check if two parties are connected' })
  async areConnected(
    @Param('fromId') fromId: string,
    @Param('toId') toId: string,
  ) {
    const connected = await this.graphService.areConnected(fromId, toId);
    return { connected };
  }

  @Get(':fromId/shortest-path/:toId')
  @ApiOperation({ summary: 'Get shortest path between two parties' })
  async getShortestPath(
    @Param('fromId') fromId: string,
    @Param('toId') toId: string,
  ) {
    const path = await this.graphService.getShortestPath(fromId, toId);
    return { path };
  }
}
