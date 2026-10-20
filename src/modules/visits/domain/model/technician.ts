import { randomUUID } from 'node:crypto';
import { InvalidTechnicianError } from '../errors/invalid-technician.error';

export interface RegisterTechnicianProps {
  name: string;
}

export interface RehydrateTechnicianProps {
  id: string;
  name: string;
  isActive: boolean;
}

export class Technician {
  private constructor(
    readonly id: string,
    readonly name: string,
    private isActiveValue: boolean,
  ) {}

  get isActive(): boolean {
    return this.isActiveValue;
  }

  static register(props: RegisterTechnicianProps): Technician {
    const name = validText(props.name, 'name', 1, 200);
    const id = randomUUID();
    return new Technician(id, name, true);
  }

  static rehydrate(props: RehydrateTechnicianProps): Technician {
    const id = validId(props.id, 'id');
    const name = validText(props.name, 'name', 1, 200);

    if (!validBoolean(props.isActive)) {
      throw new InvalidTechnicianError('Is active must be a valid boolean');
    }

    return new Technician(id, name, props.isActive);
  }

  deactivate(hasFutureScheduledVisits: boolean): void {
    if (hasFutureScheduledVisits) {
      throw new InvalidTechnicianError(
        'Cannot deactivate the technician because has future scheduled visits',
      );
    }

    this.isActiveValue = false;
  }
}

function validText(value: string, field: string, min: number, max: number): string {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) {
    throw new InvalidTechnicianError(
      `${field} must contain ${min} to ${max} non-padding characters`,
    );
  }

  return value.trim();
}

function validId(value: string, field: string): string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  ) {
    throw new InvalidTechnicianError(`${field} must be a valid UUID`);
  }
  return value;
}

function validBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}
