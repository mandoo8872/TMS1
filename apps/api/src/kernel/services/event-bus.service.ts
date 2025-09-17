import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CloudEvent, createCloudEvent } from '@tms/contracts';
import { PrismaService } from '@/database/prisma.service';

@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Emit a CloudEvent
   */
  async emit<T = any>(event: CloudEvent<T>): Promise<void> {
    try {
      // Store event in database
      await this.prisma.event.create({
        data: {
          specVersion: event.specversion,
          eventId: event.id,
          source: event.source,
          type: event.type,
          dataContentType: event.datacontenttype,
          dataSchema: event.dataschema,
          subject: event.subject,
          time: new Date(event.time),
          data: event.data as any,
        },
      });

      // Emit to internal event bus
      this.eventEmitter.emit(event.type, event);
      this.eventEmitter.emit('event.*', event); // Wildcard listener

      this.logger.debug(`Event emitted: ${event.type}`, {
        id: event.id,
        source: event.source,
        subject: event.subject,
      });
    } catch (error) {
      this.logger.error(`Failed to emit event: ${event.type}`, error);
      throw error;
    }
  }

  /**
   * Create and emit a CloudEvent
   */
  async emitDomainEvent<T = any>(
    type: string,
    data: T,
    options: {
      source?: string;
      subject?: string;
    } = {},
  ): Promise<void> {
    const event = createCloudEvent(
      type,
      options.source || 'tms.kernel',
      data,
      options.subject,
    );

    await this.emit(event);
  }

  /**
   * Subscribe to events
   */
  on(eventPattern: string, handler: (event: CloudEvent) => void | Promise<void>): void {
    this.eventEmitter.on(eventPattern, handler);
  }

  /**
   * Unsubscribe from events
   */
  off(eventPattern: string, handler: (event: CloudEvent) => void | Promise<void>): void {
    this.eventEmitter.off(eventPattern, handler);
  }

  /**
   * Get events from database
   */
  async getEvents(filters: {
    type?: string;
    source?: string;
    subject?: string;
    from?: Date;
    to?: Date;
    limit?: number;
  }): Promise<CloudEvent[]> {
    const events = await this.prisma.event.findMany({
      where: {
        ...(filters.type && { type: filters.type }),
        ...(filters.source && { source: filters.source }),
        ...(filters.subject && { subject: filters.subject }),
        ...(filters.from && { time: { gte: filters.from } }),
        ...(filters.to && { time: { lte: filters.to } }),
      },
      orderBy: { time: 'desc' },
      take: filters.limit || 100,
    });

    return events.map(e => ({
      specversion: e.specVersion as '1.0',
      id: e.eventId,
      source: e.source,
      type: e.type,
      datacontenttype: e.dataContentType || undefined,
      dataschema: e.dataSchema || undefined,
      subject: e.subject || undefined,
      time: e.time.toISOString(),
      data: e.data,
    }));
  }
}
