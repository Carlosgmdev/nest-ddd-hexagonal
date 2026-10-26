import { InvalidServiceOrderClaimError } from '../errors/service-order-claim.errors';
import { ServiceOrderClaimStatus } from './service-order-claim-status';

export interface CreateServiceOrderClaimProps {
  serviceOrderId: string;
  description: string;
  now: Date;
}

export interface RehydrateServiceOrderClaimProps {
  id: string;
  serviceOrderId: string;
  description: string;
  createdAt: Date;
  status: ServiceOrderClaimStatus;
}

export class ServiceOrderClaim {
  private constructor(
    readonly id: string,
    readonly serviceOrderId: string,
    readonly description: string,
    readonly createdAt: Date,
    readonly status: ServiceOrderClaimStatus,
  ) {}

  static create(props: CreateServiceOrderClaimProps): ServiceOrderClaim {
    const serviceOrderId = validId(props.serviceOrderId, 'serviceOrderId');
    const description = validText(props.description, 'description', 10, 2000);
    const now = validDate(props.now, 'now');

    return new ServiceOrderClaim(
      crypto.randomUUID(),
      serviceOrderId,
      description,
      now,
      ServiceOrderClaimStatus.PENDING,
    );
  }

  static rehydrate(props: RehydrateServiceOrderClaimProps): ServiceOrderClaim {
    validateSnapshot(props);

    return new ServiceOrderClaim(
      props.id,
      props.serviceOrderId,
      props.description,
      props.createdAt,
      props.status,
    );
  }
}

function validId(value: string, field: string): string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  ) {
    throw new InvalidServiceOrderClaimError(`${field} must be a valid UUID`);
  }
  return value;
}

function validText(value: string, field: string, min: number, max: number): string {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) {
    throw new InvalidServiceOrderClaimError(
      `${field} must contain ${min} to ${max} non-padding characters`,
    );
  }
  return value.trim();
}

function validDate(value: Date, field: string, earliest?: Date): Date {
  if (
    !(value instanceof Date) ||
    !Number.isFinite(value.getTime()) ||
    (earliest && value.getTime() < earliest.getTime())
  ) {
    throw new InvalidServiceOrderClaimError(
      `${field} must be a valid date consistent with the order lifecycle`,
    );
  }
  return new Date(value);
}

function validStatus(value: ServiceOrderClaimStatus, field: string): ServiceOrderClaimStatus {
  if (!Object.values(ServiceOrderClaimStatus).includes(value)) {
    throw new InvalidServiceOrderClaimError(`${field} must be a valid ServiceOrderClaimStatus`);
  }

  return value;
}

function validateSnapshot(snapshot: RehydrateServiceOrderClaimProps): void {
  validId(snapshot.id, 'id');
  validId(snapshot.serviceOrderId, 'serviceOrderId');
  validText(snapshot.description, 'description', 10, 2000);
  validStatus(snapshot.status, 'status');
  validDate(snapshot.createdAt, 'createdAt');
}
