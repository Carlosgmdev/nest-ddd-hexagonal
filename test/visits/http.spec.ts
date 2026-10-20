import { randomUUID } from 'node:crypto';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import type { Server } from 'node:http';
import { VisitsModule } from '@/modules/visits/visits.module';
import { PrismaModule } from '@shared/infrastructure/prisma/prisma.module';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { DomainExceptionFilter } from '@shared/infrastructure/http/domain-exception.filter';
import { TECHNICIAN_REPOSITORY } from '@/modules/visits/application/ports/technician.repository';
import { VISIT_REPOSITORY } from '@/modules/visits/application/ports/visit.repository';
import { SERVICE_ORDER_LOOKUP } from '@/modules/visits/application/ports/service-order-lookup';
import { Technician } from '@/modules/visits/domain/model/technician';
import type { Visit } from '@/modules/visits/domain/model/visit';
import { VisitStatus } from '@/modules/visits/domain/model/visit-status';

describe('Visits HTTP with real use cases and in-memory ports', () => {
  let app: INestApplication;
  let server: Server;
  const technicians = new Map<string, Technician>();
  const visits = new Map<string, Visit>();
  const orderId = randomUUID();
  const lookup = { findById: jest.fn() };
  const payload = (technicianId: string) => {
    const startsAt = new Date(Date.now() + 86_400_000);
    return {
      serviceOrderId: orderId,
      technicianId,
      startsAt: startsAt.toISOString(),
      endsAt: new Date(+startsAt + 3_600_000).toISOString(),
    };
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [PrismaModule, VisitsModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(TECHNICIAN_REPOSITORY)
      .useValue({
        findById: (id: string) => Promise.resolve(technicians.get(id) ?? null),
        insert: (tech: Technician) => {
          technicians.set(tech.id, tech);
          return Promise.resolve();
        },
        save: (tech: Technician) => {
          technicians.set(tech.id, tech);
          return Promise.resolve();
        },
      })
      .overrideProvider(VISIT_REPOSITORY)
      .useValue({
        findById: (id: string) => Promise.resolve(visits.get(id) ?? null),
        insert: (visit: Visit) => {
          visits.set(visit.id, visit);
          return Promise.resolve();
        },
        save: (visit: Visit) => {
          visits.set(visit.id, visit);
          return Promise.resolve();
        },
        findScheduledByTechnician: (id: string) =>
          Promise.resolve(
            [...visits.values()].filter(
              (v) => v.technicianId === id && v.status === VisitStatus.SCHEDULED,
            ),
          ),
        findScheduledByServiceOrder: (id: string) =>
          Promise.resolve(
            [...visits.values()].find(
              (v) => v.serviceOrderId === id && v.status === VisitStatus.SCHEDULED,
            ) ?? null,
          ),
      })
      .overrideProvider(SERVICE_ORDER_LOOKUP)
      .useValue(lookup)
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new DomainExceptionFilter());
    await app.init();
    server = app.getHttpServer() as Server;
  });

  beforeEach(() => {
    technicians.clear();
    visits.clear();
    lookup.findById.mockResolvedValue({ id: orderId, status: 'CREATED' });
  });

  afterAll(async () => {
    await app?.close();
  });

  it('registers, retrieves and deactivates a technician', async () => {
    const created = await request(server)
      .post('/api/technicians')
      .send({ name: ' Ana ' })
      .expect(201);
    const id = (created.body as { id: string }).id;
    const response = await request(server).get(`/api/technicians/${id}`).expect(200);
    expect(response.body).toEqual({ id, name: 'Ana', isActive: true });
    await request(server).post(`/api/technicians/${id}/deactivate`).expect(204);
    expect(technicians.get(id)?.isActive).toBe(false);
  });

  it('schedules, blocks deactivation and duplicate scheduling, then cancels', async () => {
    const tech = Technician.register({ name: 'Ana' });
    technicians.set(tech.id, tech);
    const created = await request(server).post('/api/visits').send(payload(tech.id)).expect(201);
    const id = (created.body as { id: string }).id;
    expect(visits.get(id)?.timeSlot.startsAt).toBeInstanceOf(Date);
    await request(server).post(`/api/technicians/${tech.id}/deactivate`).expect(422);
    await request(server).post('/api/visits').send(payload(tech.id)).expect(422);
    await request(server).post(`/api/visits/${id}/cancel`).expect(204);
    expect(visits.get(id)?.status).toBe(VisitStatus.CANCELLED);
    await request(server).post(`/api/visits/${id}/cancel`).expect(422);
    await request(server).post(`/api/technicians/${tech.id}/deactivate`).expect(204);
  });

  it('returns 404 for missing technicians and visits, and 400 for invalid UUIDs', async () => {
    await request(server).get(`/api/technicians/${randomUUID()}`).expect(404);
    await request(server).post(`/api/technicians/${randomUUID()}/deactivate`).expect(404);
    await request(server).post(`/api/visits/${randomUUID()}/cancel`).expect(404);
    await request(server).get('/api/technicians/invalid').expect(400);
    await request(server).post('/api/visits/invalid/cancel').expect(400);
    await request(server).post('/api/visits').send(payload(randomUUID())).expect(404);
  });

  it.each([
    { name: '   ' },
    { name: 123 },
    { name: 'a'.repeat(201) },
    { name: 'Ana', isActive: false },
    {},
  ])('rejects invalid technician input %j', async (body) => {
    await request(server).post('/api/technicians').send(body).expect(400);
    expect(technicians.size).toBe(0);
  });

  it.each([
    { startsAt: 'invalid' },
    { startsAt: '2030-02-30T10:00:00Z' },
    { startsAt: '2030-01-01T10:00:00' },
    { endsAt: '2030-01-01' },
    { technicianId: 'invalid' },
    { serviceOrderId: 'invalid' },
    { now: '2030-01-01T00:00:00Z' },
  ])('rejects invalid visit input %j', async (changes) => {
    await request(server)
      .post('/api/visits')
      .send({ ...payload(randomUUID()), ...changes })
      .expect(400);
    expect(visits.size).toBe(0);
  });

  it('maps duration errors to 422 and inactive technician errors to 409', async () => {
    const tech = Technician.register({ name: 'Ana' });
    technicians.set(tech.id, tech);
    const body = payload(tech.id);
    await request(server)
      .post('/api/visits')
      .send({ ...body, endsAt: body.startsAt })
      .expect(422);
    tech.deactivate(false);
    await request(server).post('/api/visits').send(body).expect(409);
  });

  it('rejects missing, closed and differently assigned service orders', async () => {
    const tech = Technician.register({ name: 'Ana' });
    technicians.set(tech.id, tech);
    for (const order of [
      null,
      { id: orderId, status: 'CLOSED' },
      { id: orderId, status: 'ASSIGNED', assignedTechnicianId: randomUUID() },
    ]) {
      lookup.findById.mockResolvedValueOnce(order);
      await request(server).post('/api/visits').send(payload(tech.id)).expect(422);
    }
    expect(visits.size).toBe(0);
  });
});
