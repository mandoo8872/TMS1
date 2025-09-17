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
import { ShipmentsService } from './shipments-simple.service';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { UpdateShipmentDto } from './dto/update-shipment.dto';

@ApiTags('shipments')
@Controller('shipments')
export class ShipmentsController {
  constructor(private readonly shipmentsService: ShipmentsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new shipment' })
  async create(@Body() createDto: CreateShipmentDto) {
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
  ) {
    return this.shipmentsService.findAll({
      status,
      orderId,
      carrierId,
      driverId,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get shipment by ID' })
  async findOne(@Param('id') id: string) {
    return this.shipmentsService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update shipment' })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateShipmentDto,
  ) {
    return this.shipmentsService.update(id, updateDto);
  }

  @Patch(':id/dispatch')
  @ApiOperation({ summary: 'Dispatch shipment' })
  async dispatch(@Param('id') id: string) {
    return this.shipmentsService.dispatch(id);
  }

  @Patch(':id/deliver')
  @ApiOperation({ summary: 'Mark shipment as delivered' })
  async deliver(@Param('id') id: string) {
    return this.shipmentsService.deliver(id);
  }

  // Stage endpoints
  @Post(':id/stages/advance')
  @ApiOperation({ summary: 'Advance shipment stage' })
  async advanceStage(
    @Param('id') id: string,
    @Body() body: { stageId: string; force?: boolean },
  ) {
    return this.shipmentsService.advanceStage(id, body.stageId, body.force);
  }

  @Get(':id/pipeline')
  @ApiOperation({ summary: 'Get shipment stage pipeline' })
  async getPipeline(@Param('id') id: string) {
    return this.shipmentsService.getPipeline(id);
  }
}
