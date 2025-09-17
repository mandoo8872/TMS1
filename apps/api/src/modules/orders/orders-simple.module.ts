import { Module } from '@nestjs/common';
import { OrdersController } from './orders-simple.controller';
import { OrdersService } from './orders-simple.service';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
