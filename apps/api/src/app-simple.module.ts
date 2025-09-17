import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { AppController } from './app.controller';
import { OrdersModule } from './modules/orders/orders-simple.module';
import { ShipmentsModule } from './modules/shipments/shipments-simple.module';
import { TendersModule } from './modules/tenders/tenders-simple.module';
import { SettlementsModule } from './modules/settlements/settlements-simple.module';
import { PartiesModule } from './modules/parties/parties-simple.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),

    // Core modules
    DatabaseModule,

    // Domain modules
    PartiesModule,
    OrdersModule,
    ShipmentsModule,
    TendersModule,
    SettlementsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
