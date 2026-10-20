import { InvalidServiceOrderValueError } from '../../domain/errors/service-order.errors';
import { ServiceOrderStatus } from '../../domain/model/service-order-status';
import type {
  ServiceOrderQuery,
  ServiceOrderPage,
  ListServiceOrdersOptions,
} from '../ports/service-order.query';

export class ListServiceOrdersUseCase {
  constructor(private readonly query: ServiceOrderQuery) {}

  execute(options: ListServiceOrdersOptions): Promise<ServiceOrderPage> {
    const limit = options.limit ?? 25;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new InvalidServiceOrderValueError('Page limit must be an integer between 1 and 100');
    }
    if (
      options.status !== undefined &&
      !Object.values(ServiceOrderStatus).includes(options.status)
    ) {
      throw new InvalidServiceOrderValueError('Unknown order status');
    }
    if (
      options.after &&
      (!(options.after.afterCreatedAt instanceof Date) ||
        !Number.isFinite(options.after.afterCreatedAt.getTime()) ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          options.after.afterId,
        ))
    ) {
      throw new InvalidServiceOrderValueError('Invalid pagination cursor');
    }
    return this.query.list({ ...options, limit });
  }
}
