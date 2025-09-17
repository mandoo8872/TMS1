import { Module } from '@nestjs/common';
import { TendersController } from './tenders-simple.controller';
import { TendersService } from './tenders-simple.service';

@Module({
  controllers: [TendersController],
  providers: [TendersService],
  exports: [TendersService],
})
export class TendersModule {}
