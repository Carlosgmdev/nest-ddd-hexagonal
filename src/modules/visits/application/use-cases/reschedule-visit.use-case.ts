import { TechnicianNotFoundError } from '../../domain/errors/technician-not-found.error';
import { VisitNotFoundError } from '../../domain/errors/visit-not-found.error';
import { TimeSlot } from '../../domain/model/time-slot';
import type { TechnicianAvailability } from '../../domain/services/technician-availability.service';
import type { TechnicianRepository } from '../ports/technician.repository';
import type { VisitRepository } from '../ports/visit.repository';

export interface RescheduleVisitCommand {
  visitId: string;
  startsAt: Date;
  endsAt: Date;
  now: Date;
}

export class RescheduleVisitUseCase {
  constructor(
    private readonly visits: VisitRepository,
    private readonly technicians: TechnicianRepository,
    private readonly technicianAvailability: TechnicianAvailability,
  ) {}

  async execute(command: RescheduleVisitCommand): Promise<void> {
    const { visitId, startsAt, endsAt, now } = command;
    const visit = await this.visits.findById(visitId);
    if (!visit) throw new VisitNotFoundError(visitId);
    const requestedSlot = TimeSlot.create(startsAt, endsAt);
    const { technicianId } = visit;
    const technician = await this.technicians.findById(technicianId);
    if (!technician) throw new TechnicianNotFoundError(technicianId);
    const currentTechnicianVisits = await this.visits.findScheduledByTechnician(technician.id);

    const otherCurrentTechnicianVisits = currentTechnicianVisits.filter((v) => v.id !== visit.id);

    this.technicianAvailability.ensureAvailable(
      technician,
      requestedSlot,
      otherCurrentTechnicianVisits,
    );

    visit.reschedule(requestedSlot, now);
    await this.visits.save(visit);
  }
}
