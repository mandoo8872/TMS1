import { Module } from '@nestjs/common';
import { ShipmentsController } from './shipments.controller';
import { ShipmentsService } from './shipments.service';
import { StagesService } from './stages.service';
import { StagePipelineService } from './stage-pipeline.service';

@Module({
  controllers: [ShipmentsController],
  providers: [ShipmentsService, StagesService, StagePipelineService],
  exports: [ShipmentsService, StagesService, StagePipelineService],
})
export class ShipmentsModule {}
