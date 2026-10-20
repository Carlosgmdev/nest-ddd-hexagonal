import type { Technician } from '../../domain/model/technician';

export interface TechnicianRepository {
  findById(id: string): Promise<Technician | null>;
  insert(technician: Technician): Promise<void>;
  save(technician: Technician): Promise<void>;
}

export const TECHNICIAN_REPOSITORY = Symbol('TECHNICIAN_REPOSITORY');
