import type { ServiceOrderRepository } from '../ports/service-order.repository';
import { ServiceOrderUseCaseBase } from './base';

export class AssignTechnicianUseCase extends ServiceOrderUseCaseBase {
  constructor(repository: ServiceOrderRepository) {
    super(repository);
  }

  async execute(orderId: string, technicianId: string): Promise<void> {
    const order = await this.loadOrThrow(orderId);
    order.assignTechnician(technicianId);
    await this.repository.save(order);
  }
}
