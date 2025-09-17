import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { EventBusService } from '@/kernel/services/event-bus.service';
import { ContractService } from '@/kernel/services/contract.service';
import { HookService } from '@/kernel/services/hook.service';
import { 
  Order, 
  OrderSchema, 
  EventTypes,
  OrderEventData,
} from '@tms/contracts';
import { Hooks } from '@tms/plugin-sdk';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly contracts: ContractService,
    private readonly hooks: HookService,
  ) {}

  async create(createDto: CreateOrderDto): Promise<Order> {
    // Validate contract
    const validated = this.contracts.validate(
      OrderSchema.omit({ 
        id: true, 
        createdAt: true, 
        updatedAt: true 
      }), 
      createDto,
    );

    // Execute before hook
    const hookResult = await this.hooks.executeHook(
      Hooks.BEFORE_ORDER_CREATE,
      validated,
    );

    if (!hookResult.continue) {
      throw new BadRequestException(hookResult.error || 'Order creation blocked by plugin');
    }

    const orderData = hookResult.data || validated;

    // Generate order number
    const orderNumber = await this.generateOrderNumber();

    // Create order with items
    const order = await this.prisma.order.create({
      data: {
        ...orderData,
        orderNumber,
        items: {
          create: orderData.items.map((item: any) => ({
            ...item,
            id: undefined, // Let Prisma generate IDs
          })),
        },
      },
      include: {
        items: true,
        shipper: true,
        consignee: true,
      },
    });

    // Execute after hook
    await this.hooks.executeHook(Hooks.AFTER_ORDER_CREATE, order);

    // Emit event
    await this.eventBus.emitDomainEvent<OrderEventData>(
      EventTypes.ORDER_CREATED,
      {
        orderId: order.id,
        orderNumber: order.orderNumber,
        shipperId: order.shipperId,
        consigneeId: order.consigneeId,
        status: order.status,
      },
      { subject: order.id },
    );

    return this.contracts.transform(OrderSchema, order);
  }

  async findAll(filters?: {
    status?: string;
    shipperId?: string;
    consigneeId?: string;
  }): Promise<Order[]> {
    const orders = await this.prisma.order.findMany({
      where: {
        ...(filters?.status && { status: filters.status }),
        ...(filters?.shipperId && { shipperId: filters.shipperId }),
        ...(filters?.consigneeId && { consigneeId: filters.consigneeId }),
      },
      include: {
        items: true,
        shipper: true,
        consignee: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return orders.map(o => this.contracts.transform(OrderSchema, o));
  }

  async findOne(id: string): Promise<Order> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        shipper: true,
        consignee: true,
        shipments: true,
        tenders: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }

    return this.contracts.transform(OrderSchema, order);
  }

  async update(id: string, updateDto: UpdateOrderDto): Promise<Order> {
    // Check order exists
    const existing = await this.findOne(id);

    // Validate contract
    const validated = this.contracts.validate(
      OrderSchema.partial().omit({ 
        id: true, 
        orderNumber: true,
        createdAt: true, 
        updatedAt: true 
      }), 
      updateDto,
    );

    // Execute before hook
    const hookResult = await this.hooks.executeHook(
      Hooks.BEFORE_ORDER_UPDATE,
      { id, ...validated },
    );

    if (!hookResult.continue) {
      throw new BadRequestException(hookResult.error || 'Order update blocked by plugin');
    }

    const updateData = hookResult.data || validated;

    // Update order
    const order = await this.prisma.order.update({
      where: { id },
      data: updateData,
      include: {
        items: true,
        shipper: true,
        consignee: true,
      },
    });

    // Execute after hook
    await this.hooks.executeHook(Hooks.AFTER_ORDER_UPDATE, order);

    // Emit event
    await this.eventBus.emitDomainEvent<OrderEventData>(
      EventTypes.ORDER_UPDATED,
      {
        orderId: order.id,
        orderNumber: order.orderNumber,
        shipperId: order.shipperId,
        consigneeId: order.consigneeId,
        status: order.status,
      },
      { subject: order.id },
    );

    return this.contracts.transform(OrderSchema, order);
  }

  async confirm(id: string): Promise<Order> {
    const order = await this.prisma.order.update({
      where: { id },
      data: { status: 'CONFIRMED' },
      include: {
        items: true,
        shipper: true,
        consignee: true,
      },
    });

    // Emit event
    await this.eventBus.emitDomainEvent<OrderEventData>(
      EventTypes.ORDER_CONFIRMED,
      {
        orderId: order.id,
        orderNumber: order.orderNumber,
        shipperId: order.shipperId,
        consigneeId: order.consigneeId,
        status: order.status,
      },
      { subject: order.id },
    );

    return this.contracts.transform(OrderSchema, order);
  }

  async cancel(id: string): Promise<Order> {
    // Execute before hook
    const hookResult = await this.hooks.executeHook(
      Hooks.BEFORE_ORDER_CANCEL,
      { orderId: id },
    );

    if (!hookResult.continue) {
      throw new BadRequestException(hookResult.error || 'Order cancellation blocked by plugin');
    }

    const order = await this.prisma.order.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: {
        items: true,
        shipper: true,
        consignee: true,
      },
    });

    // Execute after hook
    await this.hooks.executeHook(Hooks.AFTER_ORDER_CANCEL, order);

    // Emit event
    await this.eventBus.emitDomainEvent<OrderEventData>(
      EventTypes.ORDER_CANCELLED,
      {
        orderId: order.id,
        orderNumber: order.orderNumber,
        shipperId: order.shipperId,
        consigneeId: order.consigneeId,
        status: order.status,
      },
      { subject: order.id },
    );

    return this.contracts.transform(OrderSchema, order);
  }

  private async generateOrderNumber(): Promise<string> {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    // Get today's order count
    const startOfDay = new Date(date.setHours(0, 0, 0, 0));
    const endOfDay = new Date(date.setHours(23, 59, 59, 999));
    
    const count = await this.prisma.order.count({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });
    
    const sequence = String(count + 1).padStart(4, '0');
    return `ORD-${year}${month}${day}-${sequence}`;
  }
}
