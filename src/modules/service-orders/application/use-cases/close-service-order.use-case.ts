import type { ServiceOrderRepository } from '../ports/service-order.repository';
import { ServiceOrderUseCaseBase } from './base';

export class CloseServiceOrderUseCase extends ServiceOrderUseCaseBase {
  constructor(repository: ServiceOrderRepository) {
    super(repository);
  }

  async execute(orderId: string): Promise<void> {
    const order = await this.loadOrThrow(orderId);
    order.close();
    await this.repository.save(order);
  }
}
