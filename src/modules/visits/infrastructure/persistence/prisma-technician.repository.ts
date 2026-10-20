import { Injectable } from '@nestjs/common';
import type { TechnicianRecord } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import type { TechnicianRepository } from '../../application/ports/technician.repository';
import { Technician } from '../../domain/model/technician';

@Injectable()
export class PrismaTechnicianRepository implements TechnicianRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Technician | null> {
    const record = await this.prisma.technicianRecord.findUnique({ where: { id } });

    return record ? this.toDomain(record) : null;
  }

  async insert(technician: Technician): Promise<void> {
    await this.prisma.technicianRecord.create({
      data: { id: technician.id, ...this.toPersistence(technician) },
    });
  }

  async save(technician: Technician): Promise<void> {
    await this.prisma.technicianRecord.update({
      where: { id: technician.id },
      data: this.toPersistence(technician),
    });
  }

  private toDomain(record: TechnicianRecord): Technician {
    return Technician.rehydrate({
      id: record.id,
      name: record.name,
      isActive: record.isActive,
    });
  }

  private toPersistence(technician: Technician) {
    return {
      name: technician.name,
      isActive: technician.isActive,
    };
  }
}
