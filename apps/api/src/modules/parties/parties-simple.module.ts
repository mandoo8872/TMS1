import { Module } from '@nestjs/common';
import { PartiesController } from './parties-simple.controller';
import { PartiesService } from './parties-simple.service';

@Module({
  controllers: [PartiesController],
  providers: [PartiesService],
  exports: [PartiesService],
})
export class PartiesModule {}
