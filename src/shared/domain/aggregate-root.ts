import type { DomainEvent } from './domain-event';

export abstract class AggregateRoot {
  private readonly domainEvents: DomainEvent[] = [];

  protected record(event: DomainEvent): void {
    this.domainEvents.push(event);
  }

  getDomainEvents(): readonly DomainEvent[] {
    return Object.freeze([...this.domainEvents]);
  }

  protected clearDomainEvents(eventIds: readonly string[]): void {
    const acknowledged = new Set(eventIds);
    for (let index = this.domainEvents.length - 1; index >= 0; index -= 1) {
      if (acknowledged.has(this.domainEvents[index].eventId)) this.domainEvents.splice(index, 1);
    }
  }
}
