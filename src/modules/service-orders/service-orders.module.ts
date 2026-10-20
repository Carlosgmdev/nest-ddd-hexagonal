import { Module } from '@nestjs/common';
import {
  SERVICE_ORDER_REPOSITORY,
  type ServiceOrderRepository,
} from './application/ports/service-order.repository';
import {
  SERVICE_ORDER_QUERY,
  type ServiceOrderQuery,
} from './application/ports/service-order.query';
import { CreateServiceOrderUseCase } from './application/use-cases/create-service-order.use-case';
import { AssignTechnicianUseCase } from './application/use-cases/assign-technician.use-case';
import { AddActivityUseCase } from './application/use-cases/add-activity.use-case';
import { AddRequiredTaskUseCase } from './application/use-cases/add-required-task.use-case';
import { RegisterMaterialUseCase } from './application/use-cases/register-material.use-case';
import { CompleteRequiredTaskUseCase } from './application/use-cases/complete-required-task.use-case';
import { FinalizeServiceOrderUseCase } from './application/use-cases/finalize-service-order.use-case';
import { CloseServiceOrderUseCase } from './application/use-cases/close-service-order.use-case';
import { GetServiceOrderUseCase } from './application/use-cases/get-service-order.use-case';
import { ListServiceOrdersUseCase } from './application/use-cases/list-service-orders.use-case';
import { PrismaServiceOrderRepository } from './infrastructure/persistence/prisma-service-order.repository';
import { PrismaServiceOrderQuery } from './infrastructure/persistence/prisma-service-order.query';
import { ServiceOrdersController } from './infrastructure/http/service-orders.controller';

@Module({
  controllers: [ServiceOrdersController],
  providers: [
    {
      provide: CreateServiceOrderUseCase,
      inject: [SERVICE_ORDER_REPOSITORY],
      useFactory: (repository: ServiceOrderRepository) => new CreateServiceOrderUseCase(repository),
    },
    {
      provide: AssignTechnicianUseCase,
      inject: [SERVICE_ORDER_REPOSITORY],
      useFactory: (repository: ServiceOrderRepository) => new AssignTechnicianUseCase(repository),
    },
    {
      provide: AddActivityUseCase,
      inject: [SERVICE_ORDER_REPOSITORY],
      useFactory: (repository: ServiceOrderRepository) => new AddActivityUseCase(repository),
    },
    {
      provide: AddRequiredTaskUseCase,
      inject: [SERVICE_ORDER_REPOSITORY],
      useFactory: (repository: ServiceOrderRepository) => new AddRequiredTaskUseCase(repository),
    },
    {
      provide: RegisterMaterialUseCase,
      inject: [SERVICE_ORDER_REPOSITORY],
      useFactory: (repository: ServiceOrderRepository) => new RegisterMaterialUseCase(repository),
    },
    {
      provide: CompleteRequiredTaskUseCase,
      inject: [SERVICE_ORDER_REPOSITORY],
      useFactory: (repository: ServiceOrderRepository) =>
        new CompleteRequiredTaskUseCase(repository),
    },
    {
      provide: FinalizeServiceOrderUseCase,
      inject: [SERVICE_ORDER_REPOSITORY],
      useFactory: (repository: ServiceOrderRepository) =>
        new FinalizeServiceOrderUseCase(repository),
    },
    {
      provide: CloseServiceOrderUseCase,
      inject: [SERVICE_ORDER_REPOSITORY],
      useFactory: (repository: ServiceOrderRepository) => new CloseServiceOrderUseCase(repository),
    },
    {
      provide: GetServiceOrderUseCase,
      inject: [SERVICE_ORDER_QUERY],
      useFactory: (query: ServiceOrderQuery) => new GetServiceOrderUseCase(query),
    },
    {
      provide: ListServiceOrdersUseCase,
      inject: [SERVICE_ORDER_QUERY],
      useFactory: (query: ServiceOrderQuery) => new ListServiceOrdersUseCase(query),
    },
    { provide: SERVICE_ORDER_REPOSITORY, useClass: PrismaServiceOrderRepository },
    { provide: SERVICE_ORDER_QUERY, useClass: PrismaServiceOrderQuery },
  ],
  exports: [GetServiceOrderUseCase],
})
export class ServiceOrdersModule {}
