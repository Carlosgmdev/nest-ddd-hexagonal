import type { ServiceOrderStatus } from '../../domain/model/service-order-status';
import type { ServiceLevel } from '../../domain/model/service-level';
import type { ServicePriority } from '../../domain/model/service-priority';

export const SERVICE_ORDER_QUERY = Symbol('SERVICE_ORDER_QUERY');

export interface ServiceOrderView {
  id: string;
  version: number;
  customerId: string;
  contractId: string;
  serviceAddress: string;
  serviceLevel: ServiceLevel;
  priority: ServicePriority;
  status: ServiceOrderStatus;
  assignedTechnicianId?: string;
  activities: Array<{
    id: string;
    description: string;
    workedMinutes: number;
    performedAt: Date;
  }>;
  materials: Array<{ id: string; materialId: string; quantity: number }>;
  requiredTasks: Array<{ id: string; name: string; completedAt?: Date }>;
  createdAt: Date;
  finalizedAt?: Date;
  closedAt?: Date;
}

export interface ServiceOrderSummary {
  id: string;
  customerId: string;
  priority: ServicePriority;
  status: ServiceOrderStatus;
  assignedTechnicianId?: string;
  createdAt: Date;
}

export interface ServiceOrderCursor {
  afterId: string;
  afterCreatedAt: Date;
}

export interface ListServiceOrdersOptions {
  status?: ServiceOrderStatus;
  limit?: number;
  after?: ServiceOrderCursor;
}

export interface ServiceOrderPage {
  items: ServiceOrderSummary[];
  nextCursor?: ServiceOrderCursor;
}

export interface ServiceOrderQuery {
  getById(id: string): Promise<ServiceOrderView | null>;
  list(options: ListServiceOrdersOptions): Promise<ServiceOrderPage>;
}
