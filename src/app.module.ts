import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '@shared/infrastructure/prisma/prisma.module';
import { ServiceOrdersModule } from '@service-orders/service-orders.module';
import { AppController } from './app.controller';
import { VisitsModule } from './modules/visits/visits.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, ServiceOrdersModule, VisitsModule],
  controllers: [AppController],
})
export class AppModule {}
