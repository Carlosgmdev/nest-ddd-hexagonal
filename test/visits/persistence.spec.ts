import { randomUUID } from 'node:crypto';
import type { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { PrismaTechnicianRepository } from '@/modules/visits/infrastructure/persistence/prisma-technician.repository';
import { PrismaVisitRepository } from '@/modules/visits/infrastructure/persistence/prisma-visit.repository';
import { Technician } from '@/modules/visits/domain/model/technician';
import { Visit } from '@/modules/visits/domain/model/visit';
import { TimeSlot } from '@/modules/visits/domain/model/time-slot';
import { VisitStatus } from '@/modules/visits/domain/model/visit-status';

const collection = () => ({
  create: jest.fn().mockResolvedValue({}),
  update: jest.fn().mockResolvedValue({}),
  findUnique: jest.fn().mockResolvedValue(null),
  findFirst: jest.fn().mockResolvedValue(null),
  findMany: jest.fn().mockResolvedValue([]),
});

function setup() {
  const prisma = { technicianRecord: collection(), visitRecord: collection() };
  const client = prisma as unknown as PrismaService;
  return {
    prisma,
    technicians: new PrismaTechnicianRepository(client),
    visits: new PrismaVisitRepository(client),
  };
}

describe('Visits Prisma mapping contracts', () => {
  it('inserts and rehydrates technicians, persisting deactivation with update', async () => {
    const { prisma, technicians } = setup();
    const tech = Technician.register({ name: 'Ana' });
    await technicians.insert(tech);
    expect(prisma.technicianRecord.create).toHaveBeenCalledWith({
      data: { id: tech.id, name: 'Ana', isActive: true },
    });
    prisma.technicianRecord.findUnique.mockResolvedValue({
      id: tech.id,
      name: 'Ana',
      isActive: true,
    });
    const restored = await technicians.findById(tech.id);
    expect(restored).toBeInstanceOf(Technician);
    restored!.deactivate(false);
    await technicians.save(restored!);
    expect(prisma.technicianRecord.update).toHaveBeenCalledWith({
      where: { id: tech.id },
      data: { name: 'Ana', isActive: false },
    });
  });

  it('maps scheduled and cancelled visits and filters scheduled queries', async () => {
    const { prisma, visits } = setup();
    const now = new Date('2030-01-01T08:00:00Z');
    const startsAt = new Date('2030-01-01T10:00:00Z');
    const endsAt = new Date('2030-01-01T11:00:00Z');
    const visit = Visit.schedule({
      serviceOrderId: randomUUID(),
      technicianId: randomUUID(),
      timeSlot: TimeSlot.create(startsAt, endsAt),
      now,
    });
    const record = {
      id: visit.id,
      serviceOrderId: visit.serviceOrderId,
      technicianId: visit.technicianId,
      startsAt,
      endsAt,
      status: 'SCHEDULED',
      cancelledAt: null,
    };
    await visits.insert(visit);
    expect(prisma.visitRecord.create).toHaveBeenCalledWith({ data: record });
    prisma.visitRecord.findMany.mockResolvedValue([record]);
    const scheduled = await visits.findScheduledByTechnician(visit.technicianId);
    expect(prisma.visitRecord.findMany).toHaveBeenCalledWith({
      where: { technicianId: visit.technicianId, status: 'SCHEDULED' },
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
    });
    expect(scheduled[0].timeSlot.startsAt).toEqual(startsAt);
    prisma.visitRecord.findFirst.mockResolvedValue(record);
    expect((await visits.findScheduledByServiceOrder(visit.serviceOrderId))?.id).toBe(visit.id);
    expect(prisma.visitRecord.findFirst).toHaveBeenCalledWith({
      where: { serviceOrderId: visit.serviceOrderId, status: 'SCHEDULED' },
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
    });
    visit.cancel(now);
    await visits.save(visit);
    const { id, ...data } = { ...record, status: 'CANCELLED', cancelledAt: now };
    expect(prisma.visitRecord.update).toHaveBeenCalledWith({ where: { id }, data });
    prisma.visitRecord.findUnique.mockResolvedValue({ id, ...data });
    const cancelled = await visits.findById(id);
    expect(cancelled?.status).toBe(VisitStatus.CANCELLED);
    expect(cancelled?.cancelledAt).toEqual(now);
  });

  it('returns null when records do not exist', async () => {
    const { technicians, visits } = setup();
    expect(await technicians.findById(randomUUID())).toBeNull();
    expect(await visits.findById(randomUUID())).toBeNull();
    expect(await visits.findScheduledByServiceOrder(randomUUID())).toBeNull();
  });
});
