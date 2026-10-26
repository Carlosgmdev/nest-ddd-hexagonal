import { DomainError } from "@/shared/domain/domain-error";

export class InvalidServiceOrderClaimError extends DomainError {
  constructor(message: string) {
    super(message, 'INVALID_SERVICE_ORDER_CLAIM');
  }
}
