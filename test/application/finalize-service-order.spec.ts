import { randomUUID } from 'node:crypto';
import type { ServiceOrderRepository } from '@service-orders/application/ports/service-order.repository';
import { FinalizeServiceOrderUseCase } from '@service-orders/application/use-cases/finalize-service-order.use-case';
import { ServiceOrder } from '@service-orders/domain/model/service-order';
import { ServiceLevel } from '@service-orders/domain/model/service-level';
import { ServiceOrderStatus } from '@service-orders/domain/model/service-order-status';
import { ServiceOrderNotFoundError } from '@service-orders/domain/errors/service-order.errors';

describe('FinalizeServiceOrderUseCase', () => {
  it('persists the finalized aggregate', async () => {
    const order = ServiceOrder.create({
      customerId: randomUUID(),
      contractId: randomUUID(),
      serviceAddress: 'Plant 1',
      serviceLevel: ServiceLevel.STANDARD,
    });
    order.assignTechnician(randomUUID());
    order.addActivity('Repair', 60);
    const repository = {
      findById: jest.fn().mockResolvedValue(order),
      insert: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
    } satisfies ServiceOrderRepository;
    await new FinalizeServiceOrderUseCase(repository).execute(order.id);
    expect(repository.save).toHaveBeenCalledWith(order);
    expect(order.status).toBe(ServiceOrderStatus.FINALIZED);
  });

  it('does not save when the order does not exist', async () => {
    const repository = {
      findById: jest.fn().mockResolvedValue(null),
      insert: jest.fn(),
      save: jest.fn(),
    } satisfies ServiceOrderRepository;
    await expect(new FinalizeServiceOrderUseCase(repository).execute(randomUUID())).rejects.toThrow(
      ServiceOrderNotFoundError,
    );
    expect(repository.save).not.toHaveBeenCalled();
  });
});
