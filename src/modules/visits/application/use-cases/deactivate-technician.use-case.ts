import { InvalidTechnicianError } from '../../domain/errors/invalid-technician.error';
import { TechnicianNotFoundError } from '../../domain/errors/technician-not-found.error';
import type { TechnicianRepository } from '../ports/technician.repository';
import type { VisitRepository } from '../ports/visit.repository';

export class DeactivateTechnicianUseCase {
  constructor(
    private readonly technicians: TechnicianRepository,
    private readonly visits: VisitRepository,
  ) {}

  async execute(technicianId: string, now: Date): Promise<void> {
    if (!isValidDate(now)) {
      throw new InvalidTechnicianError('The date must be valid');
    }

    const technician = await this.technicians.findById(technicianId);

    if (!technician) {
      throw new TechnicianNotFoundError(technicianId);
    }

    const technicianScheduledVisits = await this.visits.findScheduledByTechnician(technician.id);

    const hasFutureScheduledVisits = technicianScheduledVisits.some(
      (v) => v.timeSlot.startsAt > now,
    );

    technician.deactivate(hasFutureScheduledVisits);
    await this.technicians.save(technician);
  }
}

function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}
