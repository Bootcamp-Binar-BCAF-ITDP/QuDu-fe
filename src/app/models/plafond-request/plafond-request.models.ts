export type PlafondRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type PlafondDecision = Extract<PlafondRequestStatus, 'APPROVED' | 'REJECTED'>;

export interface PlafondTier {
  plafondId: number;
  level: number;
  description: string;
  minimumAmount: number;
  maxAmount: number;
  minTenor: number;
  maxTenor: number;
  interestRate: number;
  adminFee: number;
}

export interface PlafondRequestItem {
  requestId: string;
  customerId: string;
  customerName: string;

  branchId: number | null;
  branchName: string | null;

  previousLevel: number | null;
  requestedLevel: number;

  requestedAmount: number;
  approvedAmount: number | null;

  status: PlafondRequestStatus;
  requestDate: string;
  decisionDate: string | null;

  reviewedBy: string | null;
  notes: string | null;

  requestedPlafond: PlafondTier | null;

  documents: PlafondRequestDocument[];
}

export interface PlafondDecisionBody {
  decision: PlafondDecision;
  approvedAmount?: number;
  notes?: string;
}

export interface PlafondRequestDocument {
  documentId: number;
  documentType: string;
  label: string;
  fileName: string;
  uploadedAt: string;
}
