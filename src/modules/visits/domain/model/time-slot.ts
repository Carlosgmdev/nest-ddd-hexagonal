import { InvalidTimeSlotError } from '../errors/invalid-time-slot.error';

export class TimeSlot {
  private constructor(
    private readonly startsAtValue: Date,
    private readonly endsAtValue: Date,
  ) {}

  static create(startsAt: Date, endsAt: Date): TimeSlot {
    if (!isValidDate(startsAt) || !isValidDate(endsAt)) {
      throw new InvalidTimeSlotError('Start and end dates must be valid dates');
    }

    const durationHours = getDiffHours(startsAt, endsAt);

    if (durationHours < 0.5 || durationHours > 4) {
      throw new InvalidTimeSlotError('Duration must be between 30 minutes and 4 hours');
    }

    return new TimeSlot(new Date(startsAt), new Date(endsAt));
  }

  get startsAt(): Date {
    return new Date(this.startsAtValue);
  }

  get endsAt(): Date {
    return new Date(this.endsAtValue);
  }

  overlaps(other: TimeSlot): boolean {
    return this.startsAt < other.endsAt && other.startsAt < this.endsAt;
  }
}

function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function getDiffHours(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / 3_600_000;
}
