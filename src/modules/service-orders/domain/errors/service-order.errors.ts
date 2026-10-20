import { DomainError } from '@shared/domain/domain-error';

export class ServiceOrderNotFoundError extends DomainError {
  constructor(id: string) {
    super(`Service order ${id} was not found`, 'SERVICE_ORDER_NOT_FOUND');
  }
}

export class ServiceOrderInvalidStateError extends DomainError {
  constructor(message: string) {
    super(message, 'SERVICE_ORDER_INVALID_STATE');
  }
}

export class TechnicianRequiredError extends DomainError {
  constructor() {
    super(
      'A technician must be assigned before recording or finalizing work',
      'TECHNICIAN_REQUIRED',
    );
  }
}

export class ActivityRequiredError extends DomainError {
  constructor() {
    super('At least one activity must be registered before finalization', 'ACTIVITY_REQUIRED');
  }
}

export class PendingRequiredTasksError extends DomainError {
  constructor(taskIds: readonly string[]) {
    super(`Required tasks are still pending: ${taskIds.join(', ')}`, 'PENDING_REQUIRED_TASKS');
  }
}

export class ClosedServiceOrderCannotBeModifiedError extends DomainError {
  constructor() {
    super('A closed service order cannot be modified', 'CLOSED_SERVICE_ORDER_CANNOT_BE_MODIFIED');
  }
}

export class FinalizedServiceOrderCannotBeModifiedError extends DomainError {
  constructor() {
    super(
      'A finalized service order cannot be modified',
      'FINALIZED_SERVICE_ORDER_CANNOT_BE_MODIFIED',
    );
  }
}

export class RequiredTaskNotFoundError extends DomainError {
  constructor(taskId: string) {
    super(`Required task ${taskId} was not found in the service order`, 'REQUIRED_TASK_NOT_FOUND');
  }
}

export class InvalidServiceOrderValueError extends DomainError {
  constructor(message: string) {
    super(message, 'INVALID_SERVICE_ORDER_VALUE');
  }
}

export class ServiceOrderConcurrencyError extends DomainError {
  constructor(id: string) {
    super(
      `Service order ${id} has changed; reload it before retrying`,
      'SERVICE_ORDER_CONCURRENCY_CONFLICT',
    );
  }
}
