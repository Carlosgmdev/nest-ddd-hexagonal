import type { ServiceOrderRepository } from '../ports/service-order.repository';
import { ServiceOrderUseCaseBase } from './base';

export class CompleteRequiredTaskUseCase extends ServiceOrderUseCaseBase {
  constructor(repository: ServiceOrderRepository) {
    super(repository);
  }

  async execute(orderId: string, taskId: string): Promise<void> {
    const order = await this.loadOrThrow(orderId);
    order.completeRequiredTask(taskId);
    await this.repository.save(order);
  }
}
