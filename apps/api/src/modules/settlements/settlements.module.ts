import { Module } from '@nestjs/common';
import { SettlementsController } from './settlements.controller';
import { SettlementsService } from './settlements.service';
import { SettlementChainService } from './settlement-chain.service';

@Module({
  controllers: [SettlementsController],
  providers: [SettlementsService, SettlementChainService],
  exports: [SettlementsService, SettlementChainService],
})
export class SettlementsModule {}
