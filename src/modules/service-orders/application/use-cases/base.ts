import type { ServiceOrderRepository } from '../ports/service-order.repository';
import { ServiceOrderNotFoundError } from '../../domain/errors/service-order.errors';
import type { ServiceOrder } from '../../domain/model/service-order';

export abstract class ServiceOrderUseCaseBase {
  protected constructor(protected readonly repository: ServiceOrderRepository) {}

  protected async loadOrThrow(id: string): Promise<ServiceOrder> {
    const order = await this.repository.findById(id);
    if (!order) throw new ServiceOrderNotFoundError(id);
    return order;
  }
}
