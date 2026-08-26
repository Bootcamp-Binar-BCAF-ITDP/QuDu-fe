import { LoanStatus } from "../../models/loan-application/loan-application.models";

export interface StatusChip {
  label: string;
  classes: string;
}

export const STATUS_STYLES: Record<LoanStatus, StatusChip> = {
  CHECKING: { label: 'Checking', classes: 'bg-amber-50 text-amber-700 ring-amber-200' },
  REJECTED_BY_MARKETING: {
    label: 'Rejected — marketing',
    classes: 'bg-red-50 text-red-700 ring-red-200',
  },
  PENDING_BRANCH_MANAGER: {
    label: 'Pending review',
    classes: 'bg-amber-50 text-amber-700 ring-amber-200',
  },
  REJECTED_BY_BRANCH_MANAGER: {
    label: 'Rejected — branch manager',
    classes: 'bg-red-50 text-red-700 ring-red-200',
  },
  PENDING_BACK_OFFICE: {
    label: 'With back office',
    classes: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  },
  VERIFIED: { label: 'Verified', classes: 'bg-green-50 text-green-700 ring-green-200' },
  DISBURSED: { label: 'Disbursed', classes: 'bg-green-100 text-green-800 ring-green-300' },
};

export function statusChip(status: LoanStatus): StatusChip {
  return (
    STATUS_STYLES[status] ?? {
      label: status,
      classes: 'bg-slate-100 text-slate-700 ring-slate-200',
    }
  );
}
