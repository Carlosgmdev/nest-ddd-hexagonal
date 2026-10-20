import { ServiceOrder } from '../../domain/model/service-order';
import type { ServiceLevel } from '../../domain/model/service-level';
import type { ServiceOrderRepository } from '../ports/service-order.repository';

export interface CreateServiceOrderCommand {
  customerId: string;
  contractId: string;
  serviceAddress: string;
  serviceLevel: ServiceLevel;
  requiredTasks: string[];
}

export class CreateServiceOrderUseCase {
  constructor(private readonly repository: ServiceOrderRepository) {}

  async execute(command: CreateServiceOrderCommand): Promise<string> {
    const order = ServiceOrder.create(command);
    await this.repository.insert(order);
    return order.id;
  }
}
