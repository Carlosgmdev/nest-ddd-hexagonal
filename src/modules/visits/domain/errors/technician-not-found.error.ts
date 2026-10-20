import { DomainError } from '@shared/domain/domain-error';

export class TechnicianNotFoundError extends DomainError {
  constructor(id: string) {
    super(`Technician ${id} was not found`, 'TECHNICIAN_NOT_FOUND');
  }
}
