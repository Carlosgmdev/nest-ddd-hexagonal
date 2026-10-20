import { ServiceOrderUseCaseBase } from './base';
import type { ServiceOrderRepository } from '../ports/service-order.repository';

export class AddRequiredTaskUseCase extends ServiceOrderUseCaseBase {
  constructor(repository: ServiceOrderRepository) {
    super(repository);
  }

  async execute(orderId: string, name: string): Promise<void> {
    const order = await this.loadOrThrow(orderId);
    order.addRequiredTask(name);
    await this.repository.save(order);
  }
}
