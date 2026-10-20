import type { ServiceLevelDb, ServiceOrderStatusDb, ServicePriorityDb } from '@prisma/client';
import { ServiceLevel } from '../../domain/model/service-level';
import { ServiceOrderStatus } from '../../domain/model/service-order-status';
import { ServicePriority } from '../../domain/model/service-priority';

export const serviceLevelFromDb = {
  STANDARD: ServiceLevel.STANDARD,
  PREMIUM: ServiceLevel.PREMIUM,
  CRITICAL: ServiceLevel.CRITICAL,
} satisfies Record<ServiceLevelDb, ServiceLevel>;
export const priorityFromDb = {
  NORMAL: ServicePriority.NORMAL,
  HIGH: ServicePriority.HIGH,
  URGENT: ServicePriority.URGENT,
} satisfies Record<ServicePriorityDb, ServicePriority>;
export const statusFromDb = {
  CREATED: ServiceOrderStatus.CREATED,
  ASSIGNED: ServiceOrderStatus.ASSIGNED,
  IN_PROGRESS: ServiceOrderStatus.IN_PROGRESS,
  FINALIZED: ServiceOrderStatus.FINALIZED,
  CLOSED: ServiceOrderStatus.CLOSED,
} satisfies Record<ServiceOrderStatusDb, ServiceOrderStatus>;
