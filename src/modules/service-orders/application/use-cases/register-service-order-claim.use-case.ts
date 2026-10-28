import { ServiceOrderNotFoundError } from '../../domain/errors/service-order.errors';
import { ServiceOrderClaim } from '../../domain/model/service-order-claim';
import { ServiceOrderClaimability } from '../../domain/services/service-order-claimability';
import { ServiceOrderClaimRepository } from '../ports/service-order-claim.repository';
import { ServiceOrderRepository } from '../ports/service-order.repository';

export class RegisterServiceOrderClaimUseCase {
  constructor(
    private readonly serviceOrderRepository: ServiceOrderRepository,
    private readonly serviceOrderClaimability: ServiceOrderClaimability,
    private readonly serviceOrderClaimRepository: ServiceOrderClaimRepository,
  ) {}

  async execute(serviceOrderId: string, description: string, now: Date): Promise<string> {
    const serviceOrder = await this.serviceOrderRepository.findById(serviceOrderId);
    if (!serviceOrder) throw new ServiceOrderNotFoundError(serviceOrderId);
    this.serviceOrderClaimability.ensureClaimable(serviceOrder, now);

    const serviceOrderClaim = ServiceOrderClaim.create({
      serviceOrderId: serviceOrder.id,
      description,
      now,
    });

    await this.serviceOrderClaimRepository.insert(serviceOrderClaim);
    return serviceOrderClaim.id;
  }
}
