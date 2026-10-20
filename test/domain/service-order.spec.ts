import { randomUUID } from 'node:crypto';
import { ServiceOrder } from '@service-orders/domain/model/service-order';
import { ServiceLevel } from '@service-orders/domain/model/service-level';
import { ServiceOrderStatus } from '@service-orders/domain/model/service-order-status';
import {
  InvalidServiceOrderValueError,
  PendingRequiredTasksError,
  ServiceOrderInvalidStateError,
} from '@service-orders/domain/errors/service-order.errors';

const createOrder = () =>
  ServiceOrder.create({
    id: randomUUID(),
    customerId: randomUUID(),
    contractId: randomUUID(),
    serviceAddress: 'Plant 1',
    serviceLevel: ServiceLevel.PREMIUM,
    requiredTasks: ['Safety validation'],
  });

describe('ServiceOrder aggregate', () => {
  it('derives priority from SLA/service level', () => {
    const order = createOrder();
    expect(order.priority).toBe('HIGH');
  });

  it('cannot finalize while required tasks are pending', () => {
    const order = createOrder();
    order.assignTechnician(randomUUID());
    order.addActivity('Inspection', 30);

    expect(() => order.finalize()).toThrow(PendingRequiredTasksError);
  });

  it('closes only after finalization and records an integration-ready domain event', () => {
    const order = createOrder();
    order.assignTechnician(randomUUID());
    order.addActivity('Inspection', 30);
    order.completeRequiredTask(order.requiredTasks[0].id);
    order.finalize();
    order.close();

    expect(order.status).toBe(ServiceOrderStatus.CLOSED);
    expect(order.getDomainEvents()).toHaveLength(1);
    expect(order.getDomainEvents()[0].eventName).toBe('service-orders.service-order.closed.v1');
  });

  it('adds a pending required task without changing the order status', () => {
    const order = createOrder();
    const initialStatus = order.status;
    const initialTaskCount = order.requiredTasks.length;
    const newTaskName = 'New task';
    order.addRequiredTask(newTaskName);
    const createdTask = order.requiredTasks.find((task) => task.name === newTaskName);
    expect(order.requiredTasks).toHaveLength(initialTaskCount + 1);
    expect(createdTask?.id).toBeDefined();
    expect(createdTask?.name).toBe(newTaskName);
    expect(createdTask?.completedAt).toBeUndefined();
    expect(order.status).toBe(initialStatus);
  });

  it('rejects the addition of a required task when the status is not allowed', () => {
    const order = createOrder();
    const initialTasks = order.requiredTasks;
    const initialTaskCount = order.requiredTasks.length;
    order.assignTechnician(randomUUID());
    order.addActivity('Performed activity', 30);
    expect(() => order.addRequiredTask('New task')).toThrow(ServiceOrderInvalidStateError);
    expect(order.requiredTasks).toEqual(initialTasks);
    expect(order.requiredTasks).toHaveLength(initialTaskCount);
    expect(order.status).toBe(ServiceOrderStatus.IN_PROGRESS);
  });

  it('allows the 30th required task and rejects the 31st without modifying the order', () => {
    const order = ServiceOrder.create({
      id: randomUUID(),
      customerId: randomUUID(),
      contractId: randomUUID(),
      serviceAddress: 'Plant 1',
      serviceLevel: ServiceLevel.PREMIUM,
      requiredTasks: Array.from({ length: 29 }, (_, i) => `Task ${i}`),
    });

    order.addRequiredTask('New task');
    expect(order.requiredTasks).toHaveLength(30);
    const currentTasks = order.requiredTasks;
    const currentStatus = order.status;
    expect(() => order.addRequiredTask('Another new task')).toThrow(InvalidServiceOrderValueError);
    expect(order.requiredTasks).toEqual(currentTasks);
    expect(order.status).toBe(currentStatus);
  });
});

describe('ServiceOrder integrity', () => {
  it.each([NaN, Infinity, -1, 0, 1.5, 1441])('rejects invalid worked minutes: %s', (minutes) => {
    const order = createOrder();
    order.assignTechnician(randomUUID());
    expect(() => order.addActivity('Inspection', minutes)).toThrow();
    expect(order.activities).toHaveLength(0);
    expect(order.status).toBe(ServiceOrderStatus.ASSIGNED);
  });

  it('rejects whitespace-only business values', () => {
    const props = {
      customerId: randomUUID(),
      contractId: randomUUID(),
      serviceAddress: '     ',
      serviceLevel: ServiceLevel.STANDARD,
    };
    expect(() => ServiceOrder.create(props)).toThrow();
    expect(() =>
      ServiceOrder.create({ ...props, serviceAddress: 'Plant 1', requiredTasks: [' '] }),
    ).toThrow();
    const order = createOrder();
    order.assignTechnician(randomUUID());
    expect(() => order.addActivity('   ', 30)).toThrow();
  });

  it('rejects unknown service levels including object prototype properties', () => {
    expect(() =>
      ServiceOrder.create({
        customerId: randomUUID(),
        contractId: randomUUID(),
        serviceAddress: 'Plant 1',
        serviceLevel: '__proto__' as ServiceLevel,
      }),
    ).toThrow();
  });

  it('returns frozen child snapshots and detached dates', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const order = ServiceOrder.create({
      customerId: randomUUID(),
      contractId: randomUUID(),
      serviceAddress: 'Plant 1',
      serviceLevel: ServiceLevel.STANDARD,
      now,
      requiredTasks: ['Inspection'],
    });
    now.setUTCFullYear(2000);
    expect(order.createdAt.getUTCFullYear()).toBe(2026);
    order.assignTechnician(randomUUID());
    order.addActivity('Inspection', 30, new Date('2026-01-02T00:00:00Z'));
    const activity = order.activities[0];
    expect(Object.isFrozen(activity)).toBe(true);
    expect(Reflect.set(activity, 'workedMinutes', -10)).toBe(false);
    activity.performedAt.setUTCFullYear(2000);
    order.createdAt.setUTCFullYear(2000);
    expect(order.activities[0].performedAt.getUTCFullYear()).toBe(2026);
    expect(order.createdAt.getUTCFullYear()).toBe(2026);
    expect(order.requiredTasks[0].completedAt).toBeUndefined();
    expect(Reflect.set(order.requiredTasks[0], 'completedAt', new Date())).toBe(false);
  });

  it('requires a technician to complete tasks and preserves the first completion time', () => {
    const order = createOrder();
    const taskId = order.requiredTasks[0].id;
    expect(() => order.completeRequiredTask(taskId)).toThrow();
    order.assignTechnician(randomUUID());
    const first = new Date();
    order.completeRequiredTask(taskId, first);
    order.completeRequiredTask(taskId, new Date(first.getTime() + 1000));
    expect(order.requiredTasks[0].completedAt).toEqual(first);
    first.setUTCFullYear(2000);
    expect(order.requiredTasks[0].completedAt?.getUTCFullYear()).not.toBe(2000);
  });

  it('rejects dates that contradict the lifecycle without changing state', () => {
    const order = createOrder();
    order.assignTechnician(randomUUID());
    expect(() => order.addActivity('Inspection', 30, new Date(NaN))).toThrow();
    expect(() => order.addActivity('Inspection', 30, new Date(0))).toThrow();
    order.addActivity('Inspection', 30);
    order.completeRequiredTask(order.requiredTasks[0].id);
    expect(() => order.finalize(new Date(0))).toThrow();
    expect(order.status).toBe(ServiceOrderStatus.IN_PROGRESS);
    order.finalize();
    expect(() => order.close(new Date(0))).toThrow();
    expect(order.status).toBe(ServiceOrderStatus.FINALIZED);
    expect(order.getDomainEvents()).toHaveLength(0);
  });

  it('uses the same closure time in its state and detached event payload', () => {
    const order = createOrder();
    order.assignTechnician(randomUUID());
    order.addActivity('Inspection', 30);
    order.registerMaterial(randomUUID(), 2);
    order.completeRequiredTask(order.requiredTasks[0].id);
    order.finalize();
    const now = new Date();
    order.close(now);
    const event = order.getDomainEvents()[0];
    expect(event.toPrimitives().closedAt).toBe(now.toISOString());
    expect(event.occurredAt).toEqual(order.closedAt);
    expect(Object.isFrozen(order.getDomainEvents())).toBe(true);
    event.occurredAt.setUTCFullYear(2000);
    now.setUTCFullYear(2000);
    order.closedAt?.setUTCFullYear(2000);
    const payload = event.toPrimitives();
    const materials = payload.materials as Array<{ quantity: number }>;
    materials[0].quantity = -1;
    expect(event.toPrimitives().materials).toEqual([
      { materialId: order.materials[0].materialId, quantity: 2 },
    ]);
    expect(event.occurredAt).toEqual(order.closedAt);
    expect(() => order.close()).toThrow();
    expect(order.getDomainEvents()).toHaveLength(1);
  });
});

describe('ServiceOrder rehydration', () => {
  const snapshot = () => {
    const order = createOrder();
    return {
      id: order.id,
      version: 1,
      customerId: order.customerId,
      contractId: order.contractId,
      serviceAddress: order.serviceAddress,
      serviceLevel: order.serviceLevel,
      priority: order.priority,
      status: order.status,
      activities: [...order.activities],
      materials: [...order.materials],
      requiredTasks: [...order.requiredTasks],
      createdAt: order.createdAt,
    };
  };

  it('copies persisted child records and dates without generating events', () => {
    const props = snapshot();
    const order = ServiceOrder.rehydrate(props);
    props.createdAt.setUTCFullYear(2000);
    props.requiredTasks[0] = { ...props.requiredTasks[0], name: 'Changed externally' };
    expect(order.createdAt.getUTCFullYear()).not.toBe(2000);
    expect(order.requiredTasks[0].name).toBe('Safety validation');
    expect(order.version).toBe(1);
    expect(order.getDomainEvents()).toHaveLength(0);
  });

  it('rejects snapshots that contradict lifecycle invariants', () => {
    const props = snapshot();
    expect(() => ServiceOrder.rehydrate({ ...props, version: 0 })).toThrow();
    expect(() => ServiceOrder.rehydrate({ ...props, status: ServiceOrderStatus.CLOSED })).toThrow();
    expect(() =>
      ServiceOrder.rehydrate({
        ...props,
        status: ServiceOrderStatus.IN_PROGRESS,
        assignedTechnicianId: randomUUID(),
      }),
    ).toThrow();
    expect(() =>
      ServiceOrder.rehydrate({ ...props, assignedTechnicianId: randomUUID() }),
    ).toThrow();
    expect(() =>
      ServiceOrder.rehydrate({
        ...props,
        requiredTasks: [props.requiredTasks[0], props.requiredTasks[0]],
      }),
    ).toThrow();
  });
});
