import { DomainError } from '@shared/domain/domain-error';

export class TechnicianUnavailableError extends DomainError {
  constructor(message: string) {
    super(message, 'TECHNICIAN_UNAVAILABLE');
  }
}
