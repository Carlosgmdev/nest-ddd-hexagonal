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
  resolutionReason?: string;
  resolvedAt?: Date;
}

export interface ApproveServiceOrderClaimProps {
  resolutionReason: string;
  now: Date;
}

export interface RejectServiceOrderClaimProps {
  resolutionReason: string;
  now: Date;
}

export class ServiceOrderClaim {
  private constructor(
    readonly id: string,
    readonly serviceOrderId: string,
    readonly description: string,
    private readonly createdAtValue: Date,
    private statusValue: ServiceOrderClaimStatus,
    private resolutionReasonValue?: string,
    private resolvedAtValue?: Date,
  ) {}

  get status(): ServiceOrderClaimStatus {
    return this.statusValue;
  }

  get createdAt(): Date {
    return new Date(this.createdAtValue);
  }
  get resolutionReason(): string | undefined {
    return this.resolutionReasonValue;
  }

  get resolvedAt(): Date | undefined {
    return this.resolvedAtValue ? new Date(this.resolvedAtValue) : undefined;
  }

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
    const snapshot = validateSnapshot(props);

    return new ServiceOrderClaim(
      snapshot.id,
      snapshot.serviceOrderId,
      snapshot.description,
      snapshot.createdAt,
      snapshot.status,
      snapshot.resolutionReason,
      snapshot.resolvedAt,
    );
  }

  approve(props: ApproveServiceOrderClaimProps): void {
    if (this.status !== ServiceOrderClaimStatus.PENDING) {
      throw new InvalidServiceOrderClaimError(
        `Cannot approve a service order claim that is not pending`,
      );
    }

    const now = validDate(props.now, 'now', this.createdAtValue);
    const resolutionReason = validText(props.resolutionReason, 'resolutionReason', 10, 1000);

    this.resolutionReasonValue = resolutionReason;
    this.resolvedAtValue = now;
    this.statusValue = ServiceOrderClaimStatus.APPROVED;
  }

  reject(props: RejectServiceOrderClaimProps): void {
    if (this.status !== ServiceOrderClaimStatus.PENDING) {
      throw new InvalidServiceOrderClaimError(
        `Cannot reject a service order claim that is not pending`,
      );
    }

    const now = validDate(props.now, 'now', this.createdAtValue);
    const resolutionReason = validText(props.resolutionReason, 'resolutionReason', 10, 1000);

    this.resolutionReasonValue = resolutionReason;
    this.resolvedAtValue = now;
    this.statusValue = ServiceOrderClaimStatus.REJECTED;
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

function validateSnapshot(
  snapshot: RehydrateServiceOrderClaimProps,
): RehydrateServiceOrderClaimProps {
  const id = validId(snapshot.id, 'id');
  const serviceOrderId = validId(snapshot.serviceOrderId, 'serviceOrderId');
  const description = validText(snapshot.description, 'description', 10, 2000);
  const status = validStatus(snapshot.status, 'status');
  const createdAt = validDate(snapshot.createdAt, 'createdAt');

  let resolutionReason: string | undefined;
  let resolvedAt: Date | undefined;

  if (status === ServiceOrderClaimStatus.PENDING) {
    if (snapshot.resolutionReason !== undefined || snapshot.resolvedAt !== undefined) {
      throw new InvalidServiceOrderClaimError('Pending claims must not have resolution data');
    }
  } else {
    if (snapshot.resolutionReason === undefined || snapshot.resolvedAt === undefined) {
      throw new InvalidServiceOrderClaimError(
        'Resolved claims must have a resolution reason and date',
      );
    }

    resolutionReason = validText(snapshot.resolutionReason, 'resolutionReason', 10, 1000);
    resolvedAt = validDate(snapshot.resolvedAt, 'resolvedAt', createdAt);
  }

  return { id, serviceOrderId, description, createdAt, status, resolutionReason, resolvedAt };
}
