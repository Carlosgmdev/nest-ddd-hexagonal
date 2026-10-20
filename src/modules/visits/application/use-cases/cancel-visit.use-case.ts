import { VisitNotFoundError } from '../../domain/errors/visit-not-found.error';
import type { VisitRepository } from '../ports/visit.repository';

export class CancelVisitUseCase {
  constructor(private readonly repository: VisitRepository) {}

  async execute(visitId: string, now: Date): Promise<void> {
    const visit = await this.repository.findById(visitId);

    if (!visit) {
      throw new VisitNotFoundError(visitId);
    }

    visit.cancel(now);
    await this.repository.save(visit);
  }
}
