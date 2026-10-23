import { Module } from '@nestjs/common';
import {
  TECHNICIAN_REPOSITORY,
  type TechnicianRepository,
} from './application/ports/technician.repository';
import { PrismaTechnicianRepository } from './infrastructure/persistence/prisma-technician.repository';
import { VISIT_REPOSITORY, type VisitRepository } from './application/ports/visit.repository';
import { PrismaVisitRepository } from './infrastructure/persistence/prisma-visit.repository';
import { ServiceOrdersModule } from '../service-orders/service-orders.module';
import {
  SERVICE_ORDER_LOOKUP,
  type ServiceOrderLookup,
} from './application/ports/service-order-lookup';
import { ServiceOrderLookupAdapter } from './infrastructure/integration/service-order-lookup.adapter';
import { TechnicianAvailability } from './domain/services/technician-availability.service';
import { RegisterTechnicianUseCase } from './application/use-cases/register-technician.use-case';
import { GetTechnicianUseCase } from './application/use-cases/get-technician.use-case';
import { DeactivateTechnicianUseCase } from './application/use-cases/deactivate-technician.use-case';
import { CancelVisitUseCase } from './application/use-cases/cancel-visit.use-case';
import { ScheduleVisitUseCase } from './application/use-cases/schedule-visit.use-case';
import { TechniciansController } from './infrastructure/http/technicians.controller';
import { VisitsController } from './infrastructure/http/visits.controller';
import { RescheduleVisitUseCase } from './application/use-cases/reschedule-visit.use-case';

@Module({
  imports: [ServiceOrdersModule],
  controllers: [TechniciansController, VisitsController],
  providers: [
    {
      provide: TECHNICIAN_REPOSITORY,
      useClass: PrismaTechnicianRepository,
    },
    {
      provide: VISIT_REPOSITORY,
      useClass: PrismaVisitRepository,
    },
    {
      provide: SERVICE_ORDER_LOOKUP,
      useClass: ServiceOrderLookupAdapter,
    },
    {
      provide: TechnicianAvailability,
      useFactory: () => new TechnicianAvailability(),
    },
    {
      provide: RegisterTechnicianUseCase,
      inject: [TECHNICIAN_REPOSITORY],
      useFactory: (repository: TechnicianRepository) => new RegisterTechnicianUseCase(repository),
    },
    {
      provide: GetTechnicianUseCase,
      inject: [TECHNICIAN_REPOSITORY],
      useFactory: (repository: TechnicianRepository) => new GetTechnicianUseCase(repository),
    },
    {
      provide: DeactivateTechnicianUseCase,
      inject: [TECHNICIAN_REPOSITORY, VISIT_REPOSITORY],
      useFactory: (technicians: TechnicianRepository, visits: VisitRepository) =>
        new DeactivateTechnicianUseCase(technicians, visits),
    },
    {
      provide: CancelVisitUseCase,
      inject: [VISIT_REPOSITORY],
      useFactory: (repository: VisitRepository) => new CancelVisitUseCase(repository),
    },
    {
      provide: ScheduleVisitUseCase,
      inject: [
        TECHNICIAN_REPOSITORY,
        VISIT_REPOSITORY,
        SERVICE_ORDER_LOOKUP,
        TechnicianAvailability,
      ],
      useFactory: (
        technicians: TechnicianRepository,
        visits: VisitRepository,
        serviceOrders: ServiceOrderLookup,
        availability: TechnicianAvailability,
      ) => new ScheduleVisitUseCase(technicians, visits, serviceOrders, availability),
    },
    {
      provide: RescheduleVisitUseCase,
      inject: [VISIT_REPOSITORY, TECHNICIAN_REPOSITORY, TechnicianAvailability],
      useFactory: (
        visits: VisitRepository,
        technicians: TechnicianRepository,
        technicianAvailability: TechnicianAvailability,
      ) => new RescheduleVisitUseCase(visits, technicians, technicianAvailability),
    },
  ],
})
export class VisitsModule {}
