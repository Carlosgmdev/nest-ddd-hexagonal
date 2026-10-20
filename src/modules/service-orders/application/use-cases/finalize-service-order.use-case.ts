import type { ServiceOrderRepository } from '../ports/service-order.repository';
import { ServiceOrderUseCaseBase } from './base';

export class FinalizeServiceOrderUseCase extends ServiceOrderUseCaseBase {
  constructor(repository: ServiceOrderRepository) {
    super(repository);
  }

  async execute(orderId: string): Promise<void> {
    const order = await this.loadOrThrow(orderId);
    order.finalize();
    await this.repository.save(order);
  }
}
