import { DomainError } from '@shared/domain/domain-error';

export class InvalidVisitError extends DomainError {
  constructor(message: string) {
    super(message, 'INVALID_VISIT');
  }
}
