import { Injectable } from '@nestjs/common';
import { ServiceOrderClaimRepository } from '../../application/ports/service-order-claim.repository';
import { ServiceOrderClaim } from '../../domain/model/service-order-claim';
import { PrismaService } from '@/shared/infrastructure/prisma/prisma.service';
import { ServiceOrderClaimStatus } from '../../domain/model/service-order-claim-status';
import { ServiceOrderClaimStatusDb } from '@prisma/client';

const statusFromDb = {
  PENDING: ServiceOrderClaimStatus.PENDING,
  APPROVED: ServiceOrderClaimStatus.APPROVED,
  REJECTED: ServiceOrderClaimStatus.REJECTED,
} satisfies Record<ServiceOrderClaimStatusDb, ServiceOrderClaimStatus>;

@Injectable()
export class PrismaServiceOrderClaimRepository implements ServiceOrderClaimRepository {
  constructor(private readonly prisma: PrismaService) {}

  async insert(serviceOrderClaim: ServiceOrderClaim): Promise<void> {
    await this.prisma.serviceOrderClaimRecord.create({
      data: {
        id: serviceOrderClaim.id,
        serviceOrderId: serviceOrderClaim.serviceOrderId,
        description: serviceOrderClaim.description,
        createdAt: serviceOrderClaim.createdAt,
        status: serviceOrderClaim.status,
      },
    });
  }

  async save(serviceOrderClaim: ServiceOrderClaim): Promise<void> {
    await this.prisma.serviceOrderClaimRecord.update({
      where: { id: serviceOrderClaim.id },
      data: {
        serviceOrderId: serviceOrderClaim.serviceOrderId,
        description: serviceOrderClaim.description,
        createdAt: serviceOrderClaim.createdAt,
        status: serviceOrderClaim.status,
        resolutionReason: serviceOrderClaim.resolutionReason,
        resolvedAt: serviceOrderClaim.resolvedAt,
      },
    });
  }

  async findById(id: string): Promise<ServiceOrderClaim | null> {
    const record = await this.prisma.serviceOrderClaimRecord.findUnique({ where: { id } });
    if (!record) return null;

    return ServiceOrderClaim.rehydrate({
      id: record.id,
      serviceOrderId: record.serviceOrderId,
      description: record.description,
      createdAt: record.createdAt,
      status: statusFromDb[record.status],
      resolutionReason: record.resolutionReason ?? undefined,
      resolvedAt: record.resolvedAt ?? undefined,
    });
  }
}
