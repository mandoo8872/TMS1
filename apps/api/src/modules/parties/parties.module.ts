import { Module } from '@nestjs/common';
import { PartiesController } from './parties.controller';
import { PartiesService } from './parties.service';
import { PartyRelationsService } from './party-relations.service';
import { PartyGraphService } from './party-graph.service';

@Module({
  controllers: [PartiesController],
  providers: [PartiesService, PartyRelationsService, PartyGraphService],
  exports: [PartiesService, PartyRelationsService, PartyGraphService],
})
export class PartiesModule {}
