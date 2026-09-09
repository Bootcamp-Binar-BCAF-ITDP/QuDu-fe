/** Mirrors PlafondRequestStatus on the server. */
export type PlafondRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

/** The decision endpoint only accepts these two. */
export type PlafondDecision = Extract<PlafondRequestStatus, 'APPROVED' | 'REJECTED'>;

/**
 * PlafondResponse. Note the field is `maxAmount` here, while the master-data
 * Plafond model calls the same column `maximumAmount` — keep them apart.
 */
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

/** PlafondRequestResponse. */
export interface PlafondRequestItem {
  requestId: string;
  customerId: string;
  customerName: string;

  /** Null when the customer has no plafond yet. */
  previousLevel: number | null;
  requestedLevel: number;

  requestedAmount: number;
  approvedAmount: number | null;

  status: PlafondRequestStatus;
  requestDate: string;
  decisionDate: string | null;

  /** Full name of the branch manager who decided, not an id. */
  reviewedBy: string | null;
  notes: string | null;

  requestedPlafond: PlafondTier | null;

  /** Snapshot of the customer's paperwork when the request was filed. */
  documents: PlafondRequestDocument[];
}

/** PlafondDecisionRequest. approvedAmount defaults to the requested amount. */
export interface PlafondDecisionBody {
  decision: PlafondDecision;
  approvedAmount?: number;
  notes?: string;
}

/** One document snapshotted onto a limit-increase request. */
export interface PlafondRequestDocument {
  documentId: number;
  documentType: string;
  label: string;
  fileName: string;
  uploadedAt: string;
}
