import { randomUUID } from 'node:crypto';
import { PrismaServiceOrderRepository } from '@service-orders/infrastructure/persistence/prisma-service-order.repository';
import { ServiceOrder } from '@service-orders/domain/model/service-order';
import { ServiceLevel } from '@service-orders/domain/model/service-level';
import { ServiceOrderConcurrencyError } from '@service-orders/domain/errors/service-order.errors';
import type { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

const createOrder = () =>
  ServiceOrder.create({
    customerId: randomUUID(),
    contractId: randomUUID(),
    serviceAddress: 'Plant 1',
    serviceLevel: ServiceLevel.STANDARD,
  });

function setup() {
  const collection = () => ({
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    createMany: jest.fn().mockResolvedValue({ count: 1 }),
  });
  const tx = {
    serviceOrderRecord: {
      create: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    serviceActivityRecord: collection(),
    materialUsageRecord: collection(),
    requiredTaskRecord: collection(),
    outboxEventRecord: { create: jest.fn().mockResolvedValue({}) },
  };
  const transaction = jest.fn((callback: (client: typeof tx) => Promise<void>) => callback(tx));
  const repository = new PrismaServiceOrderRepository({
    $transaction: transaction,
  } as unknown as PrismaService);
  return { repository, tx };
}

describe('PrismaServiceOrderRepository transaction contract', () => {
  it('distinguishes insertion from update and advances version after success', async () => {
    const { repository, tx } = setup();
    const order = createOrder();
    await expect(repository.save(order)).rejects.toThrow(ServiceOrderConcurrencyError);
    expect(tx.serviceOrderRecord.updateMany).not.toHaveBeenCalled();
    await repository.insert(order);
    expect(order.version).toBe(1);
    order.assignTechnician(randomUUID());
    await repository.save(order);
    expect(tx.serviceOrderRecord.updateMany).toHaveBeenCalledWith(
      expect.objectContaining<{ where: { id: string; version: number }; data: unknown }>({
        where: { id: order.id, version: 1 },
        data: expect.objectContaining({ version: { increment: 1 } }),
      }),
    );
    expect(order.version).toBe(2);
    await expect(repository.insert(order)).rejects.toThrow(ServiceOrderConcurrencyError);
  });

  it('stops a stale write before replacing children or writing events', async () => {
    const { repository, tx } = setup();
    const order = createOrder();
    await repository.insert(order);
    order.assignTechnician(randomUUID());
    order.addActivity('Repair', 30);
    order.finalize();
    order.close();
    tx.serviceActivityRecord.deleteMany.mockClear();
    tx.serviceOrderRecord.updateMany.mockResolvedValue({ count: 0 });
    await expect(repository.save(order)).rejects.toThrow(ServiceOrderConcurrencyError);
    expect(tx.serviceActivityRecord.deleteMany).not.toHaveBeenCalled();
    expect(tx.outboxEventRecord.create).not.toHaveBeenCalled();
    expect(order.version).toBe(1);
    expect(order.getDomainEvents()).toHaveLength(1);
  });

  it('retains version and pending events after an outbox failure, allowing retry', async () => {
    const { repository, tx } = setup();
    const order = createOrder();
    await repository.insert(order);
    order.assignTechnician(randomUUID());
    order.addActivity('Repair', 30);
    order.finalize();
    order.close();
    tx.outboxEventRecord.create.mockRejectedValueOnce(new Error('outbox unavailable'));
    await expect(repository.save(order)).rejects.toThrow('outbox unavailable');
    expect(order.version).toBe(1);
    expect(order.getDomainEvents()).toHaveLength(1);
    await repository.save(order);
    expect(order.version).toBe(2);
    expect(order.getDomainEvents()).toHaveLength(0);
  });
});
