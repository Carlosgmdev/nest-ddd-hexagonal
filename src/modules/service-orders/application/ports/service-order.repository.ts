import type { ServiceOrder } from '../../domain/model/service-order';

export const SERVICE_ORDER_REPOSITORY = Symbol('SERVICE_ORDER_REPOSITORY');

export interface ServiceOrderRepository {
  findById(id: string): Promise<ServiceOrder | null>;
  insert(order: ServiceOrder): Promise<void>;
  save(order: ServiceOrder): Promise<void>;
}
