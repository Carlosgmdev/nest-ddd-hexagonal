import { randomUUID } from 'node:crypto';
import { ValidationPipe } from '@nestjs/common';
import { ServiceLevelDb, ServiceOrderStatusDb, ServicePriorityDb } from '@prisma/client';
import type { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { PrismaServiceOrderQuery } from '@service-orders/infrastructure/persistence/prisma-service-order.query';
import { ListServiceOrdersQueryDto } from '@service-orders/infrastructure/http/dto/list-service-orders-query.dto';

const record = () => ({
  id: randomUUID(),
  version: 1,
  customerId: randomUUID(),
  contractId: randomUUID(),
  serviceAddress: 'Plant 1',
  serviceLevel: ServiceLevelDb.STANDARD,
  priority: ServicePriorityDb.NORMAL,
  status: ServiceOrderStatusDb.CREATED,
  assignedTechnicianId: null,
  createdAt: new Date(),
  finalizedAt: null,
  closedAt: null,
  activities: [],
  materials: [],
  requiredTasks: [],
});

describe('Service order query adapter', () => {
  it('returns a bounded page with a cursor and stable ordering', async () => {
    const rows = [record(), record(), record()];
    const findMany = jest.fn().mockResolvedValue(rows);
    const query = new PrismaServiceOrderQuery({
      serviceOrderRecord: { findMany },
    } as unknown as PrismaService);
    const first = await query.list({ limit: 2 });
    expect(first.items.map((item) => item.id)).toEqual(rows.slice(0, 2).map((item) => item.id));
    expect(first.nextCursor).toEqual({ afterId: rows[1].id, afterCreatedAt: rows[1].createdAt });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 3,
      }),
    );
    findMany.mockResolvedValue([rows[2]]);
    const second = await query.list({ limit: 2, after: first.nextCursor });
    expect(second.nextCursor).toBeUndefined();
    expect(findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          status: undefined,
          OR: [
            { createdAt: { lt: rows[1].createdAt } },
            { createdAt: rows[1].createdAt, id: { lt: rows[1].id } },
          ],
        },
      }),
    );
  });

  it('maps activities without exposing persistence-only fields', async () => {
    const row = {
      ...record(),
      activities: [
        {
          id: randomUUID(),
          description: 'Repair',
          workedMinutes: 30,
          performedAt: new Date(),
          serviceOrderId: randomUUID(),
        },
      ],
    };
    const query = new PrismaServiceOrderQuery({
      serviceOrderRecord: {
        findUnique: jest.fn().mockResolvedValue(row),
      },
    } as unknown as PrismaService);
    const result = await query.getById(row.id);
    expect(result?.activities[0]).not.toHaveProperty('serviceOrderId');
    expect(result?.version).toBe(1);
  });
});

describe('Pagination HTTP validation', () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
  const metadata = { type: 'query' as const, metatype: ListServiceOrdersQueryDto };

  it.each([
    { afterId: randomUUID() },
    { afterCreatedAt: new Date().toISOString() },
    { limit: '0' },
    { limit: '101' },
    { afterId: randomUUID(), afterCreatedAt: 'invalid' },
  ])('rejects invalid or incomplete pagination parameters: %j', async (input) => {
    await expect(pipe.transform(input, metadata)).rejects.toThrow();
  });

  it('transforms a complete cursor and numeric limit', async () => {
    const result: unknown = await pipe.transform(
      { limit: '10', afterId: randomUUID(), afterCreatedAt: new Date().toISOString() },
      metadata,
    );
    expect(result).toEqual(
      expect.objectContaining<{ limit: number; afterCreatedAt: unknown }>({
        limit: 10,
        afterCreatedAt: expect.any(Date),
      }),
    );
  });
});
