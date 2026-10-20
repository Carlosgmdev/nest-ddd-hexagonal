import { Injectable } from '@nestjs/common';

import type {
  ServiceOrderLookup,
  ServiceOrderSchedulingInfo,
} from '../../application/ports/service-order-lookup';

import { GetServiceOrderUseCase } from '@/modules/service-orders/application/use-cases/get-service-order.use-case';
import { ServiceOrderNotFoundError } from '@/modules/service-orders/domain/errors/service-order.errors';

@Injectable()
export class ServiceOrderLookupAdapter implements ServiceOrderLookup {
  constructor(private readonly getServiceOrder: GetServiceOrderUseCase) {}

  async findById(id: string): Promise<ServiceOrderSchedulingInfo | null> {
    try {
      const serviceOrder = await this.getServiceOrder.execute(id);

      return {
        id: serviceOrder.id,
        status: serviceOrder.status,
        assignedTechnicianId: serviceOrder.assignedTechnicianId,
      };
    } catch (e) {
      if (e instanceof ServiceOrderNotFoundError) {
        return null;
      }

      throw e;
    }
  }
}
