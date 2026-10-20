import { ServiceOrderNotFoundError } from '../../domain/errors/service-order.errors';
import type { ServiceOrderQuery, ServiceOrderView } from '../ports/service-order.query';

export class GetServiceOrderUseCase {
  constructor(private readonly query: ServiceOrderQuery) {}

  async execute(id: string): Promise<ServiceOrderView> {
    const result = await this.query.getById(id);
    if (!result) throw new ServiceOrderNotFoundError(id);
    return result;
  }
}
