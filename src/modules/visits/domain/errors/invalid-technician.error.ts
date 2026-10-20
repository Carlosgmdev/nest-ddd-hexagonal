import { DomainError } from '@shared/domain/domain-error';

export class InvalidTechnicianError extends DomainError {
  constructor(message: string) {
    super(message, 'INVALID_TECHNICIAN');
  }
}
