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
  Shipment, 
  ShipmentStage,
  StageAdvanceRequest,
  StageAdvanceResponse,
} from '@tms/contracts';
import { ShipmentsService } from './shipments.service';
import { StagesService } from './stages.service';
import { StagePipelineService } from './stage-pipeline.service';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { UpdateShipmentDto } from './dto/update-shipment.dto';

@ApiTags('shipments')
@Controller('shipments')
export class ShipmentsController {
  constructor(
    private readonly shipmentsService: ShipmentsService,
    private readonly stagesService: StagesService,
    private readonly pipelineService: StagePipelineService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new shipment' })
  async create(@Body() createDto: CreateShipmentDto): Promise<Shipment> {
    return this.shipmentsService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all shipments' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'orderId', required: false })
  @ApiQuery({ name: 'carrierId', required: false })
  @ApiQuery({ name: 'driverId', required: false })
  async findAll(
    @Query('status') status?: string,
    @Query('orderId') orderId?: string,
    @Query('carrierId') carrierId?: string,
    @Query('driverId') driverId?: string,
  ): Promise<Shipment[]> {
    return this.shipmentsService.findAll({
      status,
      orderId,
      carrierId,
      driverId,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get shipment by ID' })
  async findOne(@Param('id') id: string): Promise<Shipment> {
    return this.shipmentsService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update shipment' })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateShipmentDto,
  ): Promise<Shipment> {
    return this.shipmentsService.update(id, updateDto);
  }

  @Patch(':id/dispatch')
  @ApiOperation({ summary: 'Dispatch shipment' })
  async dispatch(@Param('id') id: string): Promise<Shipment> {
    return this.shipmentsService.dispatch(id);
  }

  @Patch(':id/deliver')
  @ApiOperation({ summary: 'Mark shipment as delivered' })
  async deliver(@Param('id') id: string): Promise<Shipment> {
    return this.shipmentsService.deliver(id);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel shipment' })
  async cancel(@Param('id') id: string): Promise<Shipment> {
    return this.shipmentsService.cancel(id);
  }

  // Stage endpoints
  @Post(':id/stages/advance')
  @ApiOperation({ summary: 'Advance shipment stage' })
  async advanceStage(
    @Param('id') id: string,
    @Body() request: StageAdvanceRequest,
  ): Promise<StageAdvanceResponse> {
    return this.stagesService.advanceStage(id, request);
  }

  @Patch(':id/stages/:stageId/complete')
  @ApiOperation({ summary: 'Complete a stage' })
  async completeStage(
    @Param('id') id: string,
    @Param('stageId') stageId: string,
  ): Promise<ShipmentStage> {
    return this.stagesService.completeStage(id, stageId);
  }

  @Patch(':id/stages/:stageId/skip')
  @ApiOperation({ summary: 'Skip a stage' })
  async skipStage(
    @Param('id') id: string,
    @Param('stageId') stageId: string,
    @Body('reason') reason?: string,
  ): Promise<ShipmentStage> {
    return this.stagesService.skipStage(id, stageId, reason);
  }

  // Pipeline endpoints
  @Get(':id/pipeline')
  @ApiOperation({ summary: 'Get shipment stage pipeline' })
  async getPipeline(@Param('id') id: string) {
    return this.pipelineService.getShipmentPipeline(id);
  }

  @Get(':id/pipeline/validate')
  @ApiOperation({ summary: 'Validate shipment pipeline' })
  async validatePipeline(@Param('id') id: string) {
    return this.pipelineService.validatePipeline(id);
  }

  @Get(':id/pipeline/critical-path')
  @ApiOperation({ summary: 'Get critical path through pipeline' })
  async getCriticalPath(@Param('id') id: string) {
    return this.pipelineService.getCriticalPath(id);
  }

  @Post(':id/stages/:stageId/dependencies')
  @ApiOperation({ summary: 'Add stage dependency' })
  async addDependency(
    @Param('id') id: string,
    @Param('stageId') stageId: string,
    @Body('requiredStageId') requiredStageId: string,
  ) {
    await this.pipelineService.addDependency(stageId, requiredStageId);
    return { success: true };
  }

  @Delete(':id/stages/:stageId/dependencies/:requiredStageId')
  @ApiOperation({ summary: 'Remove stage dependency' })
  async removeDependency(
    @Param('id') id: string,
    @Param('stageId') stageId: string,
    @Param('requiredStageId') requiredStageId: string,
  ) {
    await this.pipelineService.removeDependency(stageId, requiredStageId);
    return { success: true };
  }
}
