import type { Visit } from '../../domain/model/visit';

export interface VisitRepository {
  findById(id: string): Promise<Visit | null>;
  insert(visit: Visit): Promise<void>;
  save(visit: Visit): Promise<void>;
  findScheduledByTechnician(technicianId: string): Promise<Visit[]>;
  findScheduledByServiceOrder(serviceOrderId: string): Promise<Visit | null>;
}

export const VISIT_REPOSITORY = Symbol('VISIT_REPOSITORY');
