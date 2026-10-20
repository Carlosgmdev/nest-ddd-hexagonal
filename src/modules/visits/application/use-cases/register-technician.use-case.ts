import { Technician } from '../../domain/model/technician';
import type { TechnicianRepository } from '../ports/technician.repository';

export interface RegisterTechnicianCommand {
  name: string;
}

export class RegisterTechnicianUseCase {
  constructor(private readonly repository: TechnicianRepository) {}

  async execute(command: RegisterTechnicianCommand): Promise<string> {
    const technician = Technician.register(command);
    await this.repository.insert(technician);
    return technician.id;
  }
}
