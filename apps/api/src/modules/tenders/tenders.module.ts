import { Module } from '@nestjs/common';
import { TendersController } from './tenders.controller';
import { TendersService } from './tenders.service';
import { TenderOffersService } from './tender-offers.service';
import { CascadeTenderService } from './cascade-tender.service';
import { PartiesModule } from '../parties/parties.module';

@Module({
  imports: [PartiesModule],
  controllers: [TendersController],
  providers: [TendersService, TenderOffersService, CascadeTenderService],
  exports: [TendersService, TenderOffersService, CascadeTenderService],
})
export class TendersModule {}
