import {
  ALL_STATUSES,
  LoanStatus,
  STATUS_GROUPS,
  TERMINAL_STATUSES,
  isTerminal,
  statusesMatching,
} from './loan-application.models';

describe('LoanStatus', () => {
  it('lists all eight states of the loan journey', () => {
    expect(ALL_STATUSES).toHaveLength(8);
  });

  it('holds no duplicates', () => {
    expect(new Set(ALL_STATUSES).size).toBe(ALL_STATUSES.length);
  });
});

describe('isTerminal', () => {
  it('treats a disbursed loan as finished', () => {
    expect(isTerminal(LoanStatus.DISBURSED)).toBe(true);
  });

  it('treats every rejection as finished', () => {
    expect(isTerminal(LoanStatus.REJECTED_BY_MARKETING)).toBe(true);
    expect(isTerminal(LoanStatus.REJECTED_BY_BRANCH_MANAGER)).toBe(true);
    expect(isTerminal(LoanStatus.REJECTED_BY_BACK_OFFICE)).toBe(true);
  });

  it('does not treat VERIFIED as finished, because the money has not moved yet', () => {
    expect(isTerminal(LoanStatus.VERIFIED)).toBe(false);
  });

  it('treats every status still awaiting a desk as unfinished', () => {
    expect(isTerminal(LoanStatus.CHECKING)).toBe(false);
    expect(isTerminal(LoanStatus.PENDING_BRANCH_MANAGER)).toBe(false);
    expect(isTerminal(LoanStatus.PENDING_BACK_OFFICE)).toBe(false);
  });

  it('agrees with the exported list, so neither can drift from the other', () => {
    for (const status of ALL_STATUSES) {
      expect(isTerminal(status)).toBe(TERMINAL_STATUSES.includes(status));
    }
  });
});

describe('statusesMatching', () => {
  const group = (key: string) => STATUS_GROUPS.find((g) => g.key === key)!;

  it('returns nothing for the All group, which the caller reads as no status filter', () => {
    expect(statusesMatching(group('all').pattern)).toEqual([]);
  });

  it('expands Pending to the three statuses still waiting on a desk', () => {
    expect(statusesMatching(group('pending').pattern)).toEqual([
      LoanStatus.CHECKING,
      LoanStatus.PENDING_BRANCH_MANAGER,
      LoanStatus.PENDING_BACK_OFFICE,
    ]);
  });

  it('expands Approved to verified and disbursed only', () => {
    expect(statusesMatching(group('approved').pattern)).toEqual([
      LoanStatus.VERIFIED,
      LoanStatus.DISBURSED,
    ]);
  });

  it('expands Rejected to all three rejections', () => {
    expect(statusesMatching(group('rejected').pattern)).toEqual([
      LoanStatus.REJECTED_BY_MARKETING,
      LoanStatus.REJECTED_BY_BRANCH_MANAGER,
      LoanStatus.REJECTED_BY_BACK_OFFICE,
    ]);
  });

  it('anchors Approved so REJECTED_BY_BACK_OFFICE cannot slip into it', () => {
    expect(statusesMatching(group('approved').pattern)).not.toContain(
      LoanStatus.REJECTED_BY_BACK_OFFICE,
    );
  });

  it('returns them in the declared order, so an exported column is stable', () => {
    const pending = statusesMatching(group('pending').pattern);
    expect(pending).toEqual(ALL_STATUSES.filter((s) => pending.includes(s)));
  });
});

describe('STATUS_GROUPS', () => {
  const filtering = STATUS_GROUPS.filter((g) => g.pattern !== null);

  it('offers exactly one catch-all tab', () => {
    expect(STATUS_GROUPS.filter((g) => g.pattern === null)).toHaveLength(1);
  });

  it('partitions every status across its tabs, so none is unreachable by filtering', () => {
    const covered = filtering.flatMap((g) => statusesMatching(g.pattern));
    expect([...covered].sort()).toEqual([...ALL_STATUSES].sort());
  });

  it('puts no status in two tabs, so the tab counts add up to the total', () => {
    const covered = filtering.flatMap((g) => statusesMatching(g.pattern));
    expect(new Set(covered).size).toBe(covered.length);
  });

  it('gives every tab a distinct key', () => {
    const keys = STATUS_GROUPS.map((g) => g.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
