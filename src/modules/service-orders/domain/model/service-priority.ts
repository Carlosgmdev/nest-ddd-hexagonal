import { ServiceLevel } from './service-level';
import { InvalidServiceOrderValueError } from '../errors/service-order.errors';

export enum ServicePriority {
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export const priorityFromServiceLevel = (serviceLevel: ServiceLevel): ServicePriority => {
  const mapping: Record<ServiceLevel, ServicePriority> = {
    [ServiceLevel.STANDARD]: ServicePriority.NORMAL,
    [ServiceLevel.PREMIUM]: ServicePriority.HIGH,
    [ServiceLevel.CRITICAL]: ServicePriority.URGENT,
  };

  if (!Object.hasOwn(mapping, serviceLevel)) {
    throw new InvalidServiceOrderValueError('Unknown service level');
  }
  
  return mapping[serviceLevel];
};
