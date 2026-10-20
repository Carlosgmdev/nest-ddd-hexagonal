import { TechnicianNotFoundError } from '../../domain/errors/technician-not-found.error';
import type { TechnicianRepository } from '../ports/technician.repository';

export interface TechnicianView {
  id: string;
  name: string;
  isActive: boolean;
}

export class GetTechnicianUseCase {
  constructor(private readonly repository: TechnicianRepository) {}

  async execute(id: string): Promise<TechnicianView> {
    const technician = await this.repository.findById(id);

    if (!technician) {
      throw new TechnicianNotFoundError(id);
    }

    return {
      id: technician.id,
      name: technician.name,
      isActive: technician.isActive,
    };
  }
}
