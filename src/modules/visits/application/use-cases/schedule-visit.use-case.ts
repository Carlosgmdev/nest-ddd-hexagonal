import { InvalidVisitError } from '../../domain/errors/invalid-visit.error';
import { TechnicianNotFoundError } from '../../domain/errors/technician-not-found.error';
import { TimeSlot } from '../../domain/model/time-slot';
import { Visit } from '../../domain/model/visit';
import type { TechnicianAvailability } from '../../domain/services/technician-availability.service';
import type { ServiceOrderLookup } from '../ports/service-order-lookup';
import type { TechnicianRepository } from '../ports/technician.repository';
import type { VisitRepository } from '../ports/visit.repository';

export interface ScheduleVisitCommand {
  serviceOrderId: string;
  technicianId: string;
  startsAt: Date;
  endsAt: Date;
  now: Date;
}

export class ScheduleVisitUseCase {
  constructor(
    private readonly technicians: TechnicianRepository,
    private readonly visits: VisitRepository,
    private readonly serviceOrders: ServiceOrderLookup,
    private readonly availability: TechnicianAvailability,
  ) {}

  async execute(command: ScheduleVisitCommand): Promise<string> {
    const timeSlot = TimeSlot.create(command.startsAt, command.endsAt);
    const technician = await this.technicians.findById(command.technicianId);

    if (!technician) {
      throw new TechnicianNotFoundError(command.technicianId);
    }

    const serviceOrder = await this.serviceOrders.findById(command.serviceOrderId);

    if (!serviceOrder) {
      throw new InvalidVisitError(`The service order ${command.serviceOrderId} was not found`);
    }

    if (serviceOrder.status !== 'CREATED' && serviceOrder.status !== 'ASSIGNED') {
      throw new InvalidVisitError('Service order must be in CREATED or ASSIGNED status');
    }

    if (
      serviceOrder.assignedTechnicianId !== undefined &&
      serviceOrder.assignedTechnicianId !== technician.id
    ) {
      throw new InvalidVisitError('Assigned technician must match');
    }

    const scheduledServiceOrderVisit = await this.visits.findScheduledByServiceOrder(
      serviceOrder.id,
    );

    if (scheduledServiceOrderVisit) {
      throw new InvalidVisitError('Service order already has a scheduled visit');
    }

    const technicianScheduledVisits = await this.visits.findScheduledByTechnician(technician.id);
    this.availability.ensureAvailable(technician, timeSlot, technicianScheduledVisits);

    const visit = Visit.schedule({
      serviceOrderId: serviceOrder.id,
      technicianId: technician.id,
      timeSlot,
      now: command.now,
    });

    await this.visits.insert(visit);
    return visit.id;
  }
}
