import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('health')
@Controller()
export class AppController {
  @Get('health')
  @ApiOperation({ summary: 'Health check endpoint' })
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'TMS Kernel API',
      version: '1.0.0',
    };
  }

  @Get()
  @ApiOperation({ summary: 'API info' })
  getInfo() {
    return {
      name: 'TMS Kernel API',
      version: '1.0.0',
      description: 'Transportation Management System with Plugin Architecture',
      docs: '/api/docs',
    };
  }
}
