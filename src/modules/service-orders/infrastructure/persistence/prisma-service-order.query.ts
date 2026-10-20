import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import type {
  ServiceOrderQuery,
  ServiceOrderPage,
  ListServiceOrdersOptions,
  ServiceOrderView,
} from '../../application/ports/service-order.query';
import { serviceLevelFromDb, priorityFromDb, statusFromDb } from './service-order-enum.mapper';

@Injectable()
export class PrismaServiceOrderQuery implements ServiceOrderQuery {
  constructor(private readonly prisma: PrismaService) {}

  async getById(id: string): Promise<ServiceOrderView | null> {
    const record = await this.prisma.serviceOrderRecord.findUnique({
      where: { id },
      include: { activities: true, materials: true, requiredTasks: true },
    });
    if (!record) return null;

    return {
      id: record.id,
      version: record.version,
      customerId: record.customerId,
      contractId: record.contractId,
      serviceAddress: record.serviceAddress,
      serviceLevel: serviceLevelFromDb[record.serviceLevel],
      priority: priorityFromDb[record.priority],
      status: statusFromDb[record.status],
      assignedTechnicianId: record.assignedTechnicianId ?? undefined,
      activities: record.activities.map(
        ({ id: activityId, description, workedMinutes, performedAt }) => ({
          id: activityId,
          description,
          workedMinutes,
          performedAt,
        }),
      ),
      materials: record.materials.map(({ id: itemId, materialId, quantity }) => ({
        id: itemId,
        materialId,
        quantity,
      })),
      requiredTasks: record.requiredTasks.map(({ id: taskId, name, completedAt }) => ({
        id: taskId,
        name,
        completedAt: completedAt ?? undefined,
      })),
      createdAt: record.createdAt,
      finalizedAt: record.finalizedAt ?? undefined,
      closedAt: record.closedAt ?? undefined,
    };
  }

  async list({ status, limit = 25, after }: ListServiceOrdersOptions): Promise<ServiceOrderPage> {
    const records = await this.prisma.serviceOrderRecord.findMany({
      where: {
        status,
        ...(after && {
          OR: [
            { createdAt: { lt: after.afterCreatedAt } },
            { createdAt: after.afterCreatedAt, id: { lt: after.afterId } },
          ],
        }),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    const items = records.slice(0, limit).map((record) => ({
      id: record.id,
      customerId: record.customerId,
      priority: priorityFromDb[record.priority],
      status: statusFromDb[record.status],
      assignedTechnicianId: record.assignedTechnicianId ?? undefined,
      createdAt: record.createdAt,
    }));
    const last = items.at(-1);
    return {
      items,
      nextCursor:
        records.length > limit && last
          ? { afterId: last.id, afterCreatedAt: last.createdAt }
          : undefined,
    };
  }
}
