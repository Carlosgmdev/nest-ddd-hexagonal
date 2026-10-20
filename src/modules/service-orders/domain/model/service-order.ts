import { randomUUID } from 'node:crypto';
import { AggregateRoot } from '@shared/domain/aggregate-root';
import {
  ActivityRequiredError,
  InvalidServiceOrderValueError,
  ClosedServiceOrderCannotBeModifiedError,
  FinalizedServiceOrderCannotBeModifiedError,
  PendingRequiredTasksError,
  RequiredTaskNotFoundError,
  ServiceOrderInvalidStateError,
  TechnicianRequiredError,
} from '../errors/service-order.errors';
import { ServiceOrderClosedEvent } from '../events/service-order-closed.event';
import type { ServiceLevel } from './service-level';
import { ServiceOrderStatus } from './service-order-status';
import { type ServicePriority, priorityFromServiceLevel } from './service-priority';

export interface ServiceActivity {
  id: string;
  description: string;
  workedMinutes: number;
  performedAt: Date;
}

export interface MaterialUsage {
  id: string;
  materialId: string;
  quantity: number;
}

export interface RequiredTask {
  id: string;
  name: string;
  completedAt?: Date;
}

export interface CreateServiceOrderProps {
  id?: string;
  customerId: string;
  contractId: string;
  serviceAddress: string;
  serviceLevel: ServiceLevel;
  requiredTasks?: readonly string[];
  now?: Date;
}

export interface RehydrateServiceOrderProps {
  id: string;
  version: number;
  customerId: string;
  contractId: string;
  serviceAddress: string;
  serviceLevel: ServiceLevel;
  priority: ServicePriority;
  status: ServiceOrderStatus;
  assignedTechnicianId?: string;
  activities: readonly ServiceActivity[];
  materials: readonly MaterialUsage[];
  requiredTasks: readonly RequiredTask[];
  createdAt: Date;
  finalizedAt?: Date;
  closedAt?: Date;
}

export class ServiceOrder extends AggregateRoot {
  private constructor(
    readonly id: string,
    readonly customerId: string,
    readonly contractId: string,
    readonly serviceAddress: string,
    readonly serviceLevel: ServiceLevel,
    readonly priority: ServicePriority,
    private statusValue: ServiceOrderStatus,
    private assignedTechnicianIdValue: string | undefined,
    private readonly activitiesValue: ServiceActivity[],
    private readonly materialsValue: MaterialUsage[],
    private readonly requiredTasksValue: RequiredTask[],
    private readonly createdAtValue: Date,
    private finalizedAtValue?: Date,
    private closedAtValue?: Date,
    private versionValue = 0,
  ) {
    super();
  }

  static create(props: CreateServiceOrderProps): ServiceOrder {
    const now = validDate(props.now ?? new Date(), 'createdAt');
    const id = validId(props.id ?? randomUUID(), 'id');
    const customerId = validId(props.customerId, 'customerId');
    const contractId = validId(props.contractId, 'contractId');
    const address = validText(props.serviceAddress, 'serviceAddress', 5, 500);
    const priority = priorityFromServiceLevel(props.serviceLevel);
    if ((props.requiredTasks?.length ?? 0) > 30) {
      throw new InvalidServiceOrderValueError('At most 30 required tasks are allowed');
    }
    const tasks = (props.requiredTasks ?? []).map((name) => ({
      id: randomUUID(),
      name: validText(name, 'requiredTask.name', 1, 200),
    }));
    return new ServiceOrder(
      id,
      customerId,
      contractId,
      address,
      props.serviceLevel,
      priority,
      ServiceOrderStatus.CREATED,
      undefined,
      [],
      [],
      tasks,
      now,
    );
  }

  static rehydrate(props: RehydrateServiceOrderProps): ServiceOrder {
    validateSnapshot(props);
    return new ServiceOrder(
      props.id,
      props.customerId,
      props.contractId,
      props.serviceAddress,
      props.serviceLevel,
      props.priority,
      props.status,
      props.assignedTechnicianId,
      props.activities.map((activity) => ({
        ...activity,
        performedAt: new Date(activity.performedAt),
      })),
      props.materials.map((material) => ({ ...material })),
      props.requiredTasks.map((task) => ({
        ...task,
        completedAt: task.completedAt && new Date(task.completedAt),
      })),
      new Date(props.createdAt),
      props.finalizedAt && new Date(props.finalizedAt),
      props.closedAt && new Date(props.closedAt),
      props.version,
    );
  }

  get version(): number {
    return this.versionValue;
  }

  // Called by persistence only after its transaction commits.
  acknowledgePersistence(expectedVersion: number, eventIds: readonly string[]): void {
    if (this.versionValue !== expectedVersion) {
      throw new InvalidServiceOrderValueError('Unexpected persisted version');
    }
    this.versionValue += 1;
    this.clearDomainEvents(eventIds);
  }

  get createdAt(): Date {
    return new Date(this.createdAtValue);
  }

  get status(): ServiceOrderStatus {
    return this.statusValue;
  }

  get assignedTechnicianId(): string | undefined {
    return this.assignedTechnicianIdValue;
  }

  get activities(): readonly Readonly<ServiceActivity>[] {
    return Object.freeze(
      this.activitiesValue.map((activity) =>
        Object.freeze({
          ...activity,
          performedAt: new Date(activity.performedAt),
        }),
      ),
    );
  }

  get materials(): readonly Readonly<MaterialUsage>[] {
    return Object.freeze(this.materialsValue.map((material) => Object.freeze({ ...material })));
  }

  get requiredTasks(): readonly Readonly<RequiredTask>[] {
    return Object.freeze(
      this.requiredTasksValue.map((task) =>
        Object.freeze({
          ...task,
          completedAt: task.completedAt && new Date(task.completedAt),
        }),
      ),
    );
  }

  get finalizedAt(): Date | undefined {
    return this.finalizedAtValue && new Date(this.finalizedAtValue);
  }

  get closedAt(): Date | undefined {
    return this.closedAtValue && new Date(this.closedAtValue);
  }

  assignTechnician(technicianId: string): void {
    this.ensureOperationallyMutable();

    if (![ServiceOrderStatus.CREATED, ServiceOrderStatus.ASSIGNED].includes(this.statusValue)) {
      throw new ServiceOrderInvalidStateError(
        `Technician cannot be assigned while order is ${this.statusValue}`,
      );
    }

    this.assignedTechnicianIdValue = validId(technicianId, 'technicianId');
    this.statusValue = ServiceOrderStatus.ASSIGNED;
  }

  addActivity(description: string, workedMinutes: number, performedAt = new Date()): void {
    this.ensureOperationallyMutable();
    this.ensureTechnicianAssigned();

    validInteger(workedMinutes, 'workedMinutes', 1440);
    const normalizedDescription = validText(description, 'description', 3, 1000);
    const activityDate = validDate(performedAt, 'performedAt', this.createdAtValue);
    if (!Number.isSafeInteger(this.totalWorkedMinutes() + workedMinutes)) {
      throw new InvalidServiceOrderValueError('Total worked minutes exceeds the supported range');
    }

    this.activitiesValue.push({
      id: randomUUID(),
      description: normalizedDescription,
      workedMinutes,
      performedAt: activityDate,
    });
    this.statusValue = ServiceOrderStatus.IN_PROGRESS;
  }

  registerMaterial(materialId: string, quantity: number): void {
    this.ensureOperationallyMutable();
    this.ensureTechnicianAssigned();

    validId(materialId, 'materialId');
    validInteger(quantity, 'quantity', 100000);

    this.materialsValue.push({ id: randomUUID(), materialId, quantity });
    if (this.statusValue === ServiceOrderStatus.ASSIGNED) {
      this.statusValue = ServiceOrderStatus.IN_PROGRESS;
    }
  }

  addRequiredTask(name: string): void {
    if (
      this.statusValue !== ServiceOrderStatus.ASSIGNED &&
      this.statusValue !== ServiceOrderStatus.CREATED
    ) {
      throw new ServiceOrderInvalidStateError(
        'Only assigned or created service orders can receive new required tasks',
      );
    }

    if (this.requiredTasksValue.length >= 30) {
      throw new InvalidServiceOrderValueError(
        'It has reached the maximum number of required tasks',
      );
    }

    this.requiredTasksValue.push({
      id: randomUUID(),
      name: validText(name, 'requiredTask.name', 1, 200),
    });
  }

  completeRequiredTask(taskId: string, completedAt = new Date()): void {
    this.ensureOperationallyMutable();
    this.ensureTechnicianAssigned();
    validId(taskId, 'taskId');
    const task = this.requiredTasksValue.find((item) => item.id === taskId);
    if (!task) throw new RequiredTaskNotFoundError(taskId);
    if (task.completedAt) return;
    task.completedAt = validDate(completedAt, 'completedAt', this.createdAtValue);
  }

  finalize(now = new Date()): void {
    this.ensureOperationallyMutable();
    this.ensureTechnicianAssigned();

    if (this.activitiesValue.length === 0) throw new ActivityRequiredError();

    const pending = this.requiredTasksValue
      .filter((task) => !task.completedAt)
      .map((task) => task.id);
    if (pending.length > 0) throw new PendingRequiredTasksError(pending);

    if (this.statusValue !== ServiceOrderStatus.IN_PROGRESS) {
      throw new ServiceOrderInvalidStateError(
        `Only an in-progress service order can be finalized; current state is ${this.statusValue}`,
      );
    }

    const latestWork = Math.max(
      this.createdAtValue.getTime(),
      ...this.activitiesValue.map((activity) => activity.performedAt.getTime()),
      ...this.requiredTasksValue.map((task) => task.completedAt?.getTime() ?? 0),
    );
    const finalizedAt = validDate(now, 'finalizedAt', new Date(latestWork));
    this.statusValue = ServiceOrderStatus.FINALIZED;
    this.finalizedAtValue = finalizedAt;
  }

  close(now = new Date()): void {
    if (this.statusValue === ServiceOrderStatus.CLOSED) {
      throw new ServiceOrderInvalidStateError('Service order is already closed');
    }

    if (this.statusValue !== ServiceOrderStatus.FINALIZED) {
      throw new ServiceOrderInvalidStateError('Only a finalized service order can be closed');
    }

    const closedAt = validDate(now, 'closedAt', this.finalizedAtValue);
    this.statusValue = ServiceOrderStatus.CLOSED;
    this.closedAtValue = closedAt;

    this.record(
      new ServiceOrderClosedEvent(
        this.id,
        this.contractId,
        this.totalWorkedMinutes(),
        this.materialsValue.map(({ materialId, quantity }) => ({ materialId, quantity })),
        closedAt,
      ),
    );
  }

  private totalWorkedMinutes(): number {
    return this.activitiesValue.reduce((total, activity) => total + activity.workedMinutes, 0);
  }

  private ensureTechnicianAssigned(): void {
    if (!this.assignedTechnicianIdValue) throw new TechnicianRequiredError();
  }

  private ensureOperationallyMutable(): void {
    if (this.statusValue === ServiceOrderStatus.CLOSED) {
      throw new ClosedServiceOrderCannotBeModifiedError();
    }
    if (this.statusValue === ServiceOrderStatus.FINALIZED) {
      throw new FinalizedServiceOrderCannotBeModifiedError();
    }
  }
}

function validText(value: string, field: string, min: number, max: number): string {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) {
    throw new InvalidServiceOrderValueError(
      `${field} must contain ${min} to ${max} non-padding characters`,
    );
  }
  return value.trim();
}

function validId(value: string, field: string): string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  ) {
    throw new InvalidServiceOrderValueError(`${field} must be a valid UUID`);
  }
  return value;
}

function validInteger(value: number, field: string, max: number): void {
  if (!Number.isSafeInteger(value) || value < 1 || value > max) {
    throw new InvalidServiceOrderValueError(`${field} must be an integer between 1 and ${max}`);
  }
}

function validDate(value: Date, field: string, earliest?: Date): Date {
  if (
    !(value instanceof Date) ||
    !Number.isFinite(value.getTime()) ||
    (earliest && value.getTime() < earliest.getTime())
  ) {
    throw new InvalidServiceOrderValueError(
      `${field} must be a valid date consistent with the order lifecycle`,
    );
  }
  return new Date(value);
}

function validateSnapshot(props: RehydrateServiceOrderProps): void {
  validId(props.id, 'id');
  validId(props.customerId, 'customerId');
  validId(props.contractId, 'contractId');
  validText(props.serviceAddress, 'serviceAddress', 5, 500);
  if (
    !Number.isSafeInteger(props.version) ||
    props.version < 1 ||
    !Object.values(ServiceOrderStatus).includes(props.status) ||
    !priorityFromServiceLevel(props.serviceLevel) ||
    props.priority !== priorityFromServiceLevel(props.serviceLevel)
  ) {
    throw new InvalidServiceOrderValueError('Invalid persisted order metadata');
  }
  validDate(props.createdAt, 'createdAt');
  if (props.assignedTechnicianId !== undefined) validId(props.assignedTechnicianId, 'technicianId');
  if ((props.status === ServiceOrderStatus.CREATED) !== !props.assignedTechnicianId) {
    throw new InvalidServiceOrderValueError(
      'Order status and technician assignment are inconsistent',
    );
  }
  for (const activity of props.activities) {
    validId(activity.id, 'activity.id');
    validText(activity.description, 'description', 3, 1000);
    validInteger(activity.workedMinutes, 'workedMinutes', 1440);
    validDate(activity.performedAt, 'performedAt', props.createdAt);
  }
  for (const material of props.materials) {
    validId(material.id, 'materialUsage.id');
    validId(material.materialId, 'materialId');
    validInteger(material.quantity, 'quantity', 100000);
  }
  if (props.requiredTasks.length > 30)
    throw new InvalidServiceOrderValueError('Too many required tasks');
  for (const task of props.requiredTasks) {
    validId(task.id, 'task.id');
    validText(task.name, 'task.name', 1, 200);
    if (task.completedAt) validDate(task.completedAt, 'completedAt', props.createdAt);
  }
  for (const collection of [props.activities, props.materials, props.requiredTasks]) {
    if (new Set(collection.map((item) => item.id)).size !== collection.length) {
      throw new InvalidServiceOrderValueError('Duplicate child identifiers');
    }
  }
  const totalMinutes = props.activities.reduce(
    (total, activity) => total + activity.workedMinutes,
    0,
  );
  if (!Number.isSafeInteger(totalMinutes)) {
    throw new InvalidServiceOrderValueError('Total worked minutes exceeds the supported range');
  }
  const hasWork = props.activities.length > 0 || props.materials.length > 0;
  const early = [ServiceOrderStatus.CREATED, ServiceOrderStatus.ASSIGNED].includes(props.status);
  if (
    (early && hasWork) ||
    (props.status === ServiceOrderStatus.IN_PROGRESS && !hasWork) ||
    (props.status === ServiceOrderStatus.CREATED &&
      props.requiredTasks.some((task) => task.completedAt))
  ) {
    throw new InvalidServiceOrderValueError('Order status and work records are inconsistent');
  }
  const finalized = [ServiceOrderStatus.FINALIZED, ServiceOrderStatus.CLOSED].includes(
    props.status,
  );
  if (
    finalized !== !!props.finalizedAt ||
    (props.status === ServiceOrderStatus.CLOSED) !== !!props.closedAt
  ) {
    throw new InvalidServiceOrderValueError('Order status and lifecycle dates are inconsistent');
  }
  if (finalized) {
    if (!props.activities.length || props.requiredTasks.some((task) => !task.completedAt)) {
      throw new InvalidServiceOrderValueError('Finalized order has incomplete work');
    }
    const latestWork = Math.max(
      props.createdAt.getTime(),
      ...props.activities.map((activity) => activity.performedAt.getTime()),
      ...props.requiredTasks.map((task) => task.completedAt?.getTime() ?? 0),
    );
    validDate(props.finalizedAt!, 'finalizedAt', new Date(latestWork));
  }
  if (props.closedAt) validDate(props.closedAt, 'closedAt', props.finalizedAt);
}
