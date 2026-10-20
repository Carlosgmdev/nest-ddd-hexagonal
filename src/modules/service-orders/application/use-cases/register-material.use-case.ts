import type { ServiceOrderRepository } from '../ports/service-order.repository';
import { ServiceOrderUseCaseBase } from './base';

export class RegisterMaterialUseCase extends ServiceOrderUseCaseBase {
  constructor(repository: ServiceOrderRepository) {
    super(repository);
  }

  async execute(orderId: string, materialId: string, quantity: number): Promise<void> {
    const order = await this.loadOrThrow(orderId);
    order.registerMaterial(materialId, quantity);
    await this.repository.save(order);
  }
}
