const FIELD_ERROR = /^\s*([a-z][A-Za-z0-9_$]*(?:\.[A-Za-z0-9_$]+|\[\d+\])*)\s*:\s*(.+)$/;

const EMPTY_COMPLAINTS = [
  'must not be null',
  'must not be blank',
  'must not be empty',
  'is required',
  'may not be null',
  'may not be empty',
  'should not be null',
  'should not be empty',
  'tidak boleh kosong',
];

const FIELD_LABELS: Record<string, string> = {
  reviewNote: 'Review note',
  verificationNote: 'Call note',
  decisionNote: 'Decision note',
  note: 'Note',
  callStatus: 'Call status',
  applicationId: 'Application',
  requestId: 'Request',
  recommendation: 'Recommendation',
  approve: 'Decision',
  approvedAmount: 'Approved amount',
  usernameOrEmail: 'Username or email',
  roleName: 'Role name',
  menuName: 'Menu name',
  branchCode: 'Branch code',
  branchName: 'Branch name',
  fullName: 'Full name',
  phoneNumber: 'Phone number',
  accountType: 'Account type',
  minimumAmount: 'Minimum amount',
  maxAmount: 'Maximum amount',
  minTenor: 'Minimum tenor',
  maxTenor: 'Maximum tenor',
  interestRate: 'Interest rate',
  adminFee: 'Admin fee',
};

function lastSegment(field: string): string {
  const segments = field.replace(/\[\d+\]/g, '').split('.');
  return segments[segments.length - 1] || field;
}

function labelFor(field: string): string {
  const key = lastSegment(field);
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];

  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase();

  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : field;
}

function complaintFor(field: string, rawComplaint: string): string {
  const key = lastSegment(field);

  const withoutFieldName = rawComplaint
    .replace(new RegExp(`^\\s*${key}\\s+`, 'i'), '')
    .trim();

  const complaint = withoutFieldName || rawComplaint.trim();

  return EMPTY_COMPLAINTS.some((c) => complaint.toLowerCase() === c)
    ? 'must be filled'
    : complaint;
}

function humanisePart(part: string): string {
  const trimmed = part.trim();
  if (!trimmed) return '';

  const match = FIELD_ERROR.exec(trimmed);
  if (!match) return trimmed;

  const [, field, rawComplaint] = match;

  return `${labelFor(field)} ${complaintFor(field, rawComplaint)}`;
}

export function humaniseApiMessage(
  raw: string | null | undefined,
  fallback: string,
): string {
  if (raw == null || !raw.trim()) return fallback;

  const parts = raw
    .split(';')
    .map(humanisePart)
    .filter((part) => part.length > 0);

  return parts.length ? parts.join('; ') : fallback;
}

export function apiErrorMessage(error: unknown, fallback: string): string {
  const message = (error as { error?: { message?: string } })?.error?.message;
  return humaniseApiMessage(message, fallback);
}
