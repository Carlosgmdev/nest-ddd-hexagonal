import { randomUUID } from 'node:crypto';
import { Technician } from '@/modules/visits/domain/model/technician';
import { TimeSlot } from '@/modules/visits/domain/model/time-slot';
import { Visit } from '@/modules/visits/domain/model/visit';
import { TechnicianAvailability } from '@/modules/visits/domain/services/technician-availability.service';
import { VisitStatus } from '@/modules/visits/domain/model/visit-status';

const now = new Date('2030-01-01T08:00:00Z');
const start = new Date('2030-01-01T10:00:00Z');
const slot = () => TimeSlot.create(start, new Date('2030-01-01T11:00:00Z'));
const technician = () => Technician.register({ name: ' Ana ' });
const visit = (technicianId: string = randomUUID()) =>
  Visit.schedule({ serviceOrderId: randomUUID(), technicianId, timeSlot: slot(), now });

describe('Visits domain', () => {
  it('normalizes technician names and protects deactivation', () => {
    const tech = technician();
    expect(tech.name).toBe('Ana');
    expect(tech.isActive).toBe(true);
    expect(() => tech.deactivate(true)).toThrow();
    expect(tech.isActive).toBe(true);
    tech.deactivate(false);
    expect(tech.isActive).toBe(false);
    expect(() => Technician.register({ name: '   ' })).toThrow();
    expect(() => Technician.register({ name: 'a'.repeat(201) })).toThrow();
  });

  it.each([30, 240])('accepts the duration boundary of %i minutes', (minutes) => {
    expect(() => TimeSlot.create(start, new Date(+start + minutes * 60_000))).not.toThrow();
  });

  it.each([-60, 0, 29, 241])('rejects a duration of %i minutes', (minutes) => {
    expect(() => TimeSlot.create(start, new Date(+start + minutes * 60_000))).toThrow();
  });

  it('rejects invalid dates and prevents mutation through Date references', () => {
    expect(() => TimeSlot.create(new Date('invalid'), start)).toThrow();
    const input = new Date(start);
    const timeSlot = TimeSlot.create(input, new Date(+start + 3_600_000));
    input.setUTCFullYear(2000);
    timeSlot.startsAt.setUTCFullYear(2000);
    expect(timeSlot.startsAt).toEqual(start);
  });

  it('rejects overlap and inactive technicians, allowing adjacent slots', () => {
    const tech = technician();
    const availability = new TechnicianAvailability();
    const existing = visit(tech.id);
    expect(() => availability.ensureAvailable(tech, slot(), [existing])).toThrow();
    const adjacent = TimeSlot.create(
      new Date('2030-01-01T11:00:00Z'),
      new Date('2030-01-01T12:00:00Z'),
    );
    expect(() => availability.ensureAvailable(tech, adjacent, [existing])).not.toThrow();
    existing.cancel(now);
    expect(() => availability.ensureAvailable(tech, slot(), [existing])).not.toThrow();
    tech.deactivate(false);
    expect(() => availability.ensureAvailable(tech, slot(), [])).toThrow();
  });

  it('prevents scheduling in the past and cancellation after starting', () => {
    expect(() =>
      Visit.schedule({
        serviceOrderId: randomUUID(),
        technicianId: randomUUID(),
        timeSlot: slot(),
        now: new Date(+start + 1),
      }),
    ).toThrow();
    const scheduled = visit();
    expect(() => scheduled.cancel(start)).toThrow();
    expect(scheduled.status).toBe(VisitStatus.SCHEDULED);
    scheduled.cancel(now);
    expect(scheduled.status).toBe(VisitStatus.CANCELLED);
    expect(scheduled.cancelledAt).toEqual(now);
    expect(() => scheduled.cancel(now)).toThrow();
  });

  it('rejects inconsistent rehydrated visits', () => {
    const props = {
      id: randomUUID(),
      serviceOrderId: randomUUID(),
      technicianId: randomUUID(),
      timeSlot: slot(),
    };
    expect(() => Visit.rehydrate({ ...props, status: VisitStatus.CANCELLED })).toThrow();
    expect(() =>
      Visit.rehydrate({ ...props, status: VisitStatus.SCHEDULED, cancelledAt: now }),
    ).toThrow();
    expect(() =>
      Visit.rehydrate({ ...props, status: VisitStatus.CANCELLED, cancelledAt: start }),
    ).toThrow();
  });
});
