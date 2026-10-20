export interface ServiceOrderSchedulingInfo {
  id: string;
  status: 'CREATED' | 'ASSIGNED' | 'IN_PROGRESS' | 'FINALIZED' | 'CLOSED';
  assignedTechnicianId?: string;
}

export interface ServiceOrderLookup {
  findById(id: string): Promise<ServiceOrderSchedulingInfo | null>;
}

export const SERVICE_ORDER_LOOKUP = Symbol('SERVICE_ORDER_LOOKUP');
