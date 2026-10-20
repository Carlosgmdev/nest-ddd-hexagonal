import { DomainError } from '@shared/domain/domain-error';

export class VisitNotFoundError extends DomainError {
  constructor(id: string) {
    super(`Visit ${id} was not found`, 'VISIT_NOT_FOUND');
  }
}
