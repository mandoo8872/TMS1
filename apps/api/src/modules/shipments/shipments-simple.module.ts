import { Module } from '@nestjs/common';
import { ShipmentsController } from './shipments-simple.controller';
import { ShipmentsService } from './shipments-simple.service';

@Module({
  controllers: [ShipmentsController],
  providers: [ShipmentsService],
  exports: [ShipmentsService],
})
export class ShipmentsModule {}
