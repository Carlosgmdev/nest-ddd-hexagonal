import { randomUUID } from 'node:crypto';
import { InvalidVisitError } from '../errors/invalid-visit.error';
import type { TimeSlot } from './time-slot';
import { VisitStatus } from './visit-status';

export interface ScheduleVisitProps {
  serviceOrderId: string;
  technicianId: string;
  timeSlot: TimeSlot;
  now: Date;
}

export interface RehydrateVisitProps {
  id: string;
  serviceOrderId: string;
  technicianId: string;
  timeSlot: TimeSlot;
  status: VisitStatus;
  cancelledAt?: Date;
}

export class Visit {
  private constructor(
    readonly id: string,
    readonly serviceOrderId: string,
    readonly technicianId: string,
    readonly timeSlot: TimeSlot,
    private statusValue: VisitStatus,
    private cancelledAtValue?: Date,
  ) {}

  get status(): VisitStatus {
    return this.statusValue;
  }

  get cancelledAt(): Date | undefined {
    return this.cancelledAtValue ? new Date(this.cancelledAtValue) : undefined;
  }

  static schedule(props: ScheduleVisitProps): Visit {
    const serviceOrderId = validId(props.serviceOrderId, 'serviceOrderId');
    const technicianId = validId(props.technicianId, 'technicianId');

    if (!isValidDate(props.now)) {
      throw new InvalidVisitError('Invalid date');
    }

    if (props.timeSlot.startsAt < props.now) {
      throw new InvalidVisitError('Start date cannot be in the past');
    }

    const id = randomUUID();
    return new Visit(id, serviceOrderId, technicianId, props.timeSlot, VisitStatus.SCHEDULED);
  }

  static rehydrate(props: RehydrateVisitProps): Visit {
    const id = validId(props.id, 'id');
    const serviceOrderId = validId(props.serviceOrderId, 'serviceOrderId');
    const technicianId = validId(props.technicianId, 'technicianId');

    if (props.status !== VisitStatus.SCHEDULED && props.status !== VisitStatus.CANCELLED) {
      throw new InvalidVisitError('Invalid visit status');
    }

    if (props.status === VisitStatus.SCHEDULED && props.cancelledAt !== undefined) {
      throw new InvalidVisitError('Scheduled visit must not have a cancellation date');
    }

    if (props.status === VisitStatus.CANCELLED && !isValidDate(props.cancelledAt)) {
      throw new InvalidVisitError('Cancelled visit must have a valid cancellation date');
    }

    if (props.status === VisitStatus.CANCELLED && props.cancelledAt! >= props.timeSlot.startsAt) {
      throw new InvalidVisitError('Cancellation date must be before the visit starts');
    }

    const cancelledAt = props.cancelledAt ? new Date(props.cancelledAt) : undefined;
    return new Visit(id, serviceOrderId, technicianId, props.timeSlot, props.status, cancelledAt);
  }

  cancel(now: Date): void {
    if (!isValidDate(now)) {
      throw new InvalidVisitError('Invalid date');
    }

    if (this.statusValue === VisitStatus.CANCELLED) {
      throw new InvalidVisitError('Cannot cancel an already cancelled visit');
    }

    if (now >= this.timeSlot.startsAt) {
      throw new InvalidVisitError('Cannot cancel an already started visit');
    }

    this.statusValue = VisitStatus.CANCELLED;
    this.cancelledAtValue = new Date(now);
  }
}

function validId(value: string, field: string): string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  ) {
    throw new InvalidVisitError(`${field} must be a valid UUID`);
  }
  return value;
}

function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}
