import { randomUUID } from 'node:crypto';
import type { DomainEvent, JsonValue } from '@shared/domain/domain-event';

export interface ClosedMaterialSnapshot {
  materialId: string;
  quantity: number;
}

export class ServiceOrderClosedEvent implements DomainEvent {
  readonly eventId = randomUUID();
  readonly eventName = 'service-orders.service-order.closed.v1';
  private readonly occurredAtValue: number;
  private readonly materials: readonly Readonly<ClosedMaterialSnapshot>[];

  get occurredAt(): Date {
    return new Date(this.occurredAtValue);
  }

  constructor(
    readonly aggregateId: string,
    private readonly contractId: string,
    private readonly workedMinutes: number,
    materials: readonly ClosedMaterialSnapshot[],
    closedAt: Date,
  ) {
    this.occurredAtValue = closedAt.getTime();
    this.materials = Object.freeze(materials.map((item) => Object.freeze({ ...item })));
    Object.freeze(this);
  }

  toPrimitives(): Record<string, JsonValue> {
    return {
      serviceOrderId: this.aggregateId,
      contractId: this.contractId,
      workedMinutes: this.workedMinutes,
      materials: this.materials.map((item) => ({ ...item })),
      closedAt: this.occurredAt.toISOString(),
    };
  }
}
