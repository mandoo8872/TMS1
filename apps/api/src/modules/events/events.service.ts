import { Injectable } from '@nestjs/common';
import { CloudEvent } from '@tms/contracts';
import { EventBusService } from '@/kernel/services/event-bus.service';
import { PrismaService } from '@/database/prisma.service';

@Injectable()
export class EventsService {
  constructor(
    private readonly eventBus: EventBusService,
    private readonly prisma: PrismaService,
  ) {}

  async getEvents(filters: {
    type?: string;
    source?: string;
    subject?: string;
    from?: Date;
    to?: Date;
    limit?: number;
  }): Promise<CloudEvent[]> {
    return this.eventBus.getEvents(filters);
  }

  async getEventById(eventId: string): Promise<CloudEvent | null> {
    const event = await this.prisma.event.findFirst({
      where: { eventId },
    });

    if (!event) {
      return null;
    }

    return {
      specversion: event.specVersion as '1.0',
      id: event.eventId,
      source: event.source,
      type: event.type,
      datacontenttype: event.dataContentType || undefined,
      dataschema: event.dataSchema || undefined,
      subject: event.subject || undefined,
      time: event.time.toISOString(),
      data: event.data,
    };
  }
}
