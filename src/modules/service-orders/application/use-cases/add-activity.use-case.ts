import type { ServiceOrderRepository } from '../ports/service-order.repository';
import { ServiceOrderUseCaseBase } from './base';

export class AddActivityUseCase extends ServiceOrderUseCaseBase {
  constructor(repository: ServiceOrderRepository) {
    super(repository);
  }

  async execute(orderId: string, description: string, workedMinutes: number): Promise<void> {
    const order = await this.loadOrThrow(orderId);
    order.addActivity(description, workedMinutes);
    await this.repository.save(order);
  }
}
