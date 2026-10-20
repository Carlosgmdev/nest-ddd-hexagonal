import { Injectable } from '@nestjs/common';
import type { VisitRecord, VisitStatusDb } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import type { VisitRepository } from '../../application/ports/visit.repository';
import { TimeSlot } from '../../domain/model/time-slot';
import { Visit } from '../../domain/model/visit';
import { VisitStatus } from '../../domain/model/visit-status';

const statusFromDb = {
  SCHEDULED: VisitStatus.SCHEDULED,
  CANCELLED: VisitStatus.CANCELLED,
} satisfies Record<VisitStatusDb, VisitStatus>;

const statusToDb = {
  [VisitStatus.SCHEDULED]: 'SCHEDULED',
  [VisitStatus.CANCELLED]: 'CANCELLED',
} satisfies Record<VisitStatus, VisitStatusDb>;

@Injectable()
export class PrismaVisitRepository implements VisitRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Visit | null> {
    const record = await this.prisma.visitRecord.findUnique({ where: { id } });

    return record ? this.toDomain(record) : null;
  }

  async insert(visit: Visit): Promise<void> {
    await this.prisma.visitRecord.create({
      data: { id: visit.id, ...this.toPersistence(visit) },
    });
  }

  async save(visit: Visit): Promise<void> {
    await this.prisma.visitRecord.update({
      where: { id: visit.id },
      data: this.toPersistence(visit),
    });
  }

  async findScheduledByTechnician(technicianId: string): Promise<Visit[]> {
    const records = await this.prisma.visitRecord.findMany({
      where: { technicianId, status: statusToDb[VisitStatus.SCHEDULED] },
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
    });

    return records.map((record) => this.toDomain(record));
  }

  async findScheduledByServiceOrder(serviceOrderId: string): Promise<Visit | null> {
    const record = await this.prisma.visitRecord.findFirst({
      where: { serviceOrderId, status: statusToDb[VisitStatus.SCHEDULED] },
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
    });

    return record ? this.toDomain(record) : null;
  }

  private toDomain(record: VisitRecord): Visit {
    return Visit.rehydrate({
      id: record.id,
      serviceOrderId: record.serviceOrderId,
      technicianId: record.technicianId,
      timeSlot: TimeSlot.create(record.startsAt, record.endsAt),
      status: statusFromDb[record.status],
      cancelledAt: record.cancelledAt ?? undefined,
    });
  }

  private toPersistence(visit: Visit) {
    return {
      serviceOrderId: visit.serviceOrderId,
      technicianId: visit.technicianId,
      startsAt: visit.timeSlot.startsAt,
      endsAt: visit.timeSlot.endsAt,
      status: statusToDb[visit.status],
      cancelledAt: visit.cancelledAt ?? null,
    };
  }
}
