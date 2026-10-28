import { InvalidServiceOrderClaimError } from '../errors/service-order-claim.errors';
import { ServiceOrderInvalidStateError } from '../errors/service-order.errors';
import { ServiceOrder } from '../model/service-order';
import { ServiceOrderStatus } from '../model/service-order-status';

export class ServiceOrderClaimability {
  ensureClaimable(serviceOrder: ServiceOrder, now: Date): void {
    if (serviceOrder.status !== ServiceOrderStatus.CLOSED)
      throw new ServiceOrderInvalidStateError('Service order to claim must be closed');

    validDate(now, 'now');
    const diffHours = getDiffHours(serviceOrder.closedAt!, now);

    if (diffHours < 0 || diffHours > 168)
      throw new InvalidServiceOrderClaimError(
        'Claims must be registered between closure and 168 hours after closure',
      );
  }
}

function getDiffHours(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / 3_600_000;
}

function validDate(value: Date, field: string, earliest?: Date): Date {
  if (
    !(value instanceof Date) ||
    !Number.isFinite(value.getTime()) ||
    (earliest && value.getTime() < earliest.getTime())
  ) {
    throw new InvalidServiceOrderClaimError(
      `${field} must be a valid date consistent with the order claim lifecycle`,
    );
  }
  return new Date(value);
}
