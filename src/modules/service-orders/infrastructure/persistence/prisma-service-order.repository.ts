import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ServiceOrderConcurrencyError } from '../../domain/errors/service-order.errors';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import type { ServiceOrderRepository } from '../../application/ports/service-order.repository';
import { ServiceOrder, type RehydrateServiceOrderProps } from '../../domain/model/service-order';
import { serviceLevelFromDb, priorityFromDb, statusFromDb } from './service-order-enum.mapper';

@Injectable()
export class PrismaServiceOrderRepository implements ServiceOrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<ServiceOrder | null> {
    const record = await this.prisma.serviceOrderRecord.findUnique({
      where: { id },
      include: { activities: true, materials: true, requiredTasks: true },
    });

    if (!record) return null;

    return ServiceOrder.rehydrate({
      id: record.id,
      version: record.version,
      customerId: record.customerId,
      contractId: record.contractId,
      serviceAddress: record.serviceAddress,
      serviceLevel: serviceLevelFromDb[record.serviceLevel],
      priority: priorityFromDb[record.priority],
      status: statusFromDb[record.status],
      assignedTechnicianId: record.assignedTechnicianId ?? undefined,
      activities: record.activities.map((item) => ({
        id: item.id,
        description: item.description,
        workedMinutes: item.workedMinutes,
        performedAt: item.performedAt,
      })),
      materials: record.materials.map((item) => ({
        id: item.id,
        materialId: item.materialId,
        quantity: item.quantity,
      })),
      requiredTasks: record.requiredTasks.map((item) => ({
        id: item.id,
        name: item.name,
        completedAt: item.completedAt ?? undefined,
      })),
      createdAt: record.createdAt,
      finalizedAt: record.finalizedAt ?? undefined,
      closedAt: record.closedAt ?? undefined,
    } satisfies RehydrateServiceOrderProps);
  }

  insert(order: ServiceOrder): Promise<void> {
    return this.persist(order, true);
  }

  save(order: ServiceOrder): Promise<void> {
    return this.persist(order, false);
  }

  private async persist(order: ServiceOrder, isNew: boolean): Promise<void> {
    const expectedVersion = order.version;
    if ((isNew && expectedVersion !== 0) || (!isNew && expectedVersion < 1)) {
      throw new ServiceOrderConcurrencyError(order.id);
    }
    const events = [...order.getDomainEvents()];
    const activities = order.activities;
    const materials = order.materials;
    const tasks = order.requiredTasks;
    const createInput = this.toCreateInput(order);
    const updateInput = this.toUpdateInput(order);
    try {
      await this.prisma.$transaction(async (tx) => {
        if (isNew) {
          await tx.serviceOrderRecord.create({ data: createInput });
        } else {
          const result = await tx.serviceOrderRecord.updateMany({
            where: { id: order.id, version: expectedVersion },
            data: { ...updateInput, version: { increment: 1 } },
          });
          if (result.count !== 1) throw new ServiceOrderConcurrencyError(order.id);
        }

        await Promise.all([
          tx.serviceActivityRecord.deleteMany({ where: { serviceOrderId: order.id } }),
          tx.materialUsageRecord.deleteMany({ where: { serviceOrderId: order.id } }),
          tx.requiredTaskRecord.deleteMany({ where: { serviceOrderId: order.id } }),
        ]);

        if (activities.length > 0) {
          await tx.serviceActivityRecord.createMany({
            data: activities.map((item) => ({ ...item, serviceOrderId: order.id })),
          });
        }

        if (materials.length > 0) {
          await tx.materialUsageRecord.createMany({
            data: materials.map((item) => ({ ...item, serviceOrderId: order.id })),
          });
        }

        if (tasks.length > 0) {
          await tx.requiredTaskRecord.createMany({
            data: tasks.map((item) => ({
              id: item.id,
              serviceOrderId: order.id,
              name: item.name,
              completedAt: item.completedAt,
            })),
          });
        }

        for (const event of events) {
          await tx.outboxEventRecord.create({
            data: {
              id: event.eventId,
              eventName: event.eventName,
              aggregateId: event.aggregateId,
              payload: event.toPrimitives(),
              occurredAt: event.occurredAt,
            },
          });
        }
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2034' || (isNew && error.code === 'P2002'))
      ) {
        throw new ServiceOrderConcurrencyError(order.id);
      }
      throw error;
    }
    order.acknowledgePersistence(
      expectedVersion,
      events.map((event) => event.eventId),
    );
  }

  private toCreateInput(order: ServiceOrder): Prisma.ServiceOrderRecordCreateInput {
    return {
      id: order.id,
      version: 1,
      customerId: order.customerId,
      contractId: order.contractId,
      serviceAddress: order.serviceAddress,
      serviceLevel: order.serviceLevel,
      priority: order.priority,
      status: order.status,
      assignedTechnicianId: order.assignedTechnicianId,
      createdAt: order.createdAt,
      finalizedAt: order.finalizedAt,
      closedAt: order.closedAt,
    };
  }

  private toUpdateInput(order: ServiceOrder): Prisma.ServiceOrderRecordUpdateInput {
    return {
      serviceAddress: order.serviceAddress,
      serviceLevel: order.serviceLevel,
      priority: order.priority,
      status: order.status,
      assignedTechnicianId: order.assignedTechnicianId,
      finalizedAt: order.finalizedAt,
      closedAt: order.closedAt,
    };
  }
}
