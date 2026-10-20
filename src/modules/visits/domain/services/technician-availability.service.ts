import { TechnicianUnavailableError } from '../errors/technician-unavailable.error';
import { type Technician } from '../model/technician';
import { type TimeSlot } from '../model/time-slot';
import { type Visit } from '../model/visit';
import { VisitStatus } from '../model/visit-status';

export class TechnicianAvailability {
  ensureAvailable(
    technician: Technician,
    requestedSlot: TimeSlot,
    existingVisits: readonly Visit[],
  ): void {
    if (!technician.isActive) {
      throw new TechnicianUnavailableError('The technician is inactive');
    }

    const overlapFound = existingVisits.some(
      (v) =>
        v.technicianId === technician.id &&
        v.status === VisitStatus.SCHEDULED &&
        v.timeSlot.overlaps(requestedSlot),
    );

    if (overlapFound) {
      throw new TechnicianUnavailableError(
        'The requested time slot overlaps with another technician visit(s)',
      );
    }
  }
}
