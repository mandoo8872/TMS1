import { Module } from '@nestjs/common';
import { SettlementsController } from './settlements-simple.controller';
import { SettlementsService } from './settlements-simple.service';

@Module({
  controllers: [SettlementsController],
  providers: [SettlementsService],
  exports: [SettlementsService],
})
export class SettlementsModule {}
