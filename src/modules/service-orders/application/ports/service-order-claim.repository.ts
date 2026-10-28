import { ServiceOrderClaim } from '../../domain/model/service-order-claim';

export const SERVICE_ORDER_CLAIM_REPOSITORY = Symbol('SERVICE_ORDER_CLAIM_REPOSITORY');

export interface ServiceOrderClaimRepository {
  insert(serviceOrderClaim: ServiceOrderClaim): Promise<void>;
  save(ServiceOrderClaim: ServiceOrderClaim): Promise<void>;
  findById(id: string): Promise<ServiceOrderClaim | null>;
}
