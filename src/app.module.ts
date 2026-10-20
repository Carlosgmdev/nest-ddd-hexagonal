import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '@shared/infrastructure/prisma/prisma.module';
import { ServiceOrdersModule } from '@service-orders/service-orders.module';
import { AppController } from './app.controller';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, ServiceOrdersModule],
  controllers: [AppController],
})
export class AppModule {}
