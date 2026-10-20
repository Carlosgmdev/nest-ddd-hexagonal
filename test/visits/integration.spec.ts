import { randomUUID } from 'node:crypto';
import { ServiceOrderLookupAdapter } from '@/modules/visits/infrastructure/integration/service-order-lookup.adapter';
import type { GetServiceOrderUseCase } from '@service-orders/application/use-cases/get-service-order.use-case';
import { ServiceOrderNotFoundError } from '@service-orders/domain/errors/service-order.errors';

describe('ServiceOrderLookupAdapter', () => {
  const execute = jest.fn();
  const adapter = new ServiceOrderLookupAdapter({ execute } as unknown as GetServiceOrderUseCase);

  beforeEach(() => execute.mockReset());

  it('exposes only the scheduling information from the other context', async () => {
    const id = randomUUID();
    const assignedTechnicianId = randomUUID();
    execute.mockResolvedValue({
      id,
      status: 'ASSIGNED',
      assignedTechnicianId,
      customerId: randomUUID(),
    });
    expect(await adapter.findById(id)).toEqual({ id, status: 'ASSIGNED', assignedTechnicianId });
    expect(execute).toHaveBeenCalledWith(id);
  });

  it('translates missing orders to null', async () => {
    const id = randomUUID();
    execute.mockRejectedValue(new ServiceOrderNotFoundError(id));
    expect(await adapter.findById(id)).toBeNull();
  });

  it('propagates unexpected failures instead of treating them as missing orders', async () => {
    const failure = new Error('Database unavailable');
    execute.mockRejectedValue(failure);
    await expect(adapter.findById(randomUUID())).rejects.toBe(failure);
  });
});
