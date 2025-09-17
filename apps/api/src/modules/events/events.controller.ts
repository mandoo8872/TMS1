import { Controller, Get, Query, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { EventsService } from './events.service';
import { CloudEvent } from '@tms/contracts';

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  @ApiOperation({ summary: 'Get events with filters' })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'source', required: false })
  @ApiQuery({ name: 'subject', required: false })
  @ApiQuery({ name: 'from', required: false, type: Date })
  @ApiQuery({ name: 'to', required: false, type: Date })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getEvents(
    @Query('type') type?: string,
    @Query('source') source?: string,
    @Query('subject') subject?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ): Promise<CloudEvent[]> {
    return this.eventsService.getEvents({
      type,
      source,
      subject,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get event by ID' })
  async getEvent(@Param('id') id: string): Promise<CloudEvent | null> {
    return this.eventsService.getEventById(id);
  }
}
