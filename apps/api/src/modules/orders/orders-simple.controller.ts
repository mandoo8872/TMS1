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
import { OrdersService } from './orders-simple.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new order' })
  async create(@Body() createDto: CreateOrderDto) {
    return this.ordersService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all orders' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'shipperId', required: false })
  @ApiQuery({ name: 'consigneeId', required: false })
  async findAll(
    @Query('status') status?: string,
    @Query('shipperId') shipperId?: string,
    @Query('consigneeId') consigneeId?: string,
  ) {
    return this.ordersService.findAll({
      status,
      shipperId,
      consigneeId,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order by ID' })
  async findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update order' })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateOrderDto,
  ) {
    return this.ordersService.update(id, updateDto);
  }

  @Patch(':id/confirm')
  @ApiOperation({ summary: 'Confirm order' })
  async confirm(@Param('id') id: string) {
    return this.ordersService.confirm(id);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel order' })
  async cancel(@Param('id') id: string) {
    return this.ordersService.cancel(id);
  }
}
