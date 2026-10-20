import { DomainError } from '@shared/domain/domain-error';

export class InvalidTimeSlotError extends DomainError {
  constructor(message: string) {
    super(message, 'INVALID_TIME_SLOT');
  }
}
