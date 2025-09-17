import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createDto: CreateOrderDto) {
    // Generate order number
    const orderNumber = await this.generateOrderNumber();

    // Create order with items
    const order = await this.prisma.order.create({
      data: {
        orderNumber,
        shipperId: createDto.shipperId,
        consigneeId: createDto.consigneeId,
        status: createDto.status || 'DRAFT',
        pickupLocation: JSON.stringify(createDto.pickupLocation),
        deliveryLocation: JSON.stringify(createDto.deliveryLocation),
        requestedPickupDate: new Date(createDto.requestedPickupDate),
        requestedDeliveryDate: new Date(createDto.requestedDeliveryDate),
        metadata: createDto.metadata ? JSON.stringify(createDto.metadata) : null,
        items: {
          create: createDto.items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            weight: item.weight,
            volume: item.volume,
            metadata: item.metadata ? JSON.stringify(item.metadata) : null,
          })),
        },
      },
      include: {
        items: true,
        shipper: true,
        consignee: true,
      },
    });

    return this.transformOrder(order);
  }

  async findAll(filters?: {
    status?: string;
    shipperId?: string;
    consigneeId?: string;
  }) {
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
        shipments: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return orders.map(order => this.transformOrder(order));
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        shipper: true,
        consignee: true,
        shipments: {
          include: {
            stages: true,
          },
        },
        tenders: {
          include: {
            offers: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }

    return this.transformOrder(order);
  }

  async update(id: string, updateDto: UpdateOrderDto) {
    // Check order exists
    await this.findOne(id);

    // Update order
    const order = await this.prisma.order.update({
      where: { id },
      data: {
        ...(updateDto.status && { status: updateDto.status }),
        ...(updateDto.pickupLocation && { 
          pickupLocation: JSON.stringify(updateDto.pickupLocation) 
        }),
        ...(updateDto.deliveryLocation && { 
          deliveryLocation: JSON.stringify(updateDto.deliveryLocation) 
        }),
        ...(updateDto.requestedPickupDate && { 
          requestedPickupDate: new Date(updateDto.requestedPickupDate) 
        }),
        ...(updateDto.requestedDeliveryDate && { 
          requestedDeliveryDate: new Date(updateDto.requestedDeliveryDate) 
        }),
        ...(updateDto.metadata && { 
          metadata: JSON.stringify(updateDto.metadata) 
        }),
      },
      include: {
        items: true,
        shipper: true,
        consignee: true,
      },
    });

    return this.transformOrder(order);
  }

  async confirm(id: string) {
    const order = await this.prisma.order.update({
      where: { id },
      data: { status: 'CONFIRMED' },
      include: {
        items: true,
        shipper: true,
        consignee: true,
      },
    });

    return this.transformOrder(order);
  }

  async cancel(id: string) {
    const order = await this.prisma.order.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: {
        items: true,
        shipper: true,
        consignee: true,
      },
    });

    return this.transformOrder(order);
  }

  private transformOrder(order: any) {
    return {
      ...order,
      pickupLocation: this.parseJson(order.pickupLocation),
      deliveryLocation: this.parseJson(order.deliveryLocation),
      metadata: this.parseJson(order.metadata),
      items: order.items?.map((item: any) => ({
        ...item,
        metadata: this.parseJson(item.metadata),
      })),
    };
  }

  private parseJson(jsonString: string | null) {
    if (!jsonString) return null;
    try {
      return JSON.parse(jsonString);
    } catch {
      return jsonString;
    }
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
