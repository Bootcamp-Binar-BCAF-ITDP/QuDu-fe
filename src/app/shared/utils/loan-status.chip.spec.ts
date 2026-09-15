import { ALL_STATUSES, LoanStatus } from '../../models/loan-application/loan-application.models';
import { STATUS_STYLES, statusChip } from './loan-status.chip';

describe('statusChip', () => {
  it('covers every status the backend can send, so none renders unstyled', () => {
    for (const status of ALL_STATUSES) {
      expect(STATUS_STYLES[status]).toBeDefined();
    }
  });

  it('declares no chip for a status that does not exist', () => {
    expect(Object.keys(STATUS_STYLES).sort()).toEqual([...ALL_STATUSES].sort());
  });

  it('gives every chip a human label rather than the raw enum', () => {
    for (const status of ALL_STATUSES) {
      expect(statusChip(status).label).not.toBe(status);
      expect(statusChip(status).label.trim()).not.toBe('');
    }
  });

  it('colours the three rejection statuses alike, so a reader sees one outcome', () => {
    const rejected = ALL_STATUSES.filter((s) => s.startsWith('REJECTED_'));

    expect(rejected).toHaveLength(3);
    for (const status of rejected) {
      expect(statusChip(status).classes).toContain('red');
    }
  });

  it('spells out which desk rejected it, because all three read REJECTED to the API', () => {
    expect(statusChip(LoanStatus.REJECTED_BY_MARKETING).label).toContain('marketing');
    expect(statusChip(LoanStatus.REJECTED_BY_BRANCH_MANAGER).label).toContain('branch manager');
    expect(statusChip(LoanStatus.REJECTED_BY_BACK_OFFICE).label).toContain('back office');
  });

  it('falls back to a neutral chip for a status added to the backend but not here', () => {
    const chip = statusChip('SOMETHING_NEW' as LoanStatus);

    expect(chip.label).toBe('SOMETHING_NEW');
    expect(chip.classes).toContain('slate');
  });

  it('gives every chip a background, a text colour and a ring, so the shape is uniform', () => {
    for (const status of ALL_STATUSES) {
      const { classes } = statusChip(status);

      expect(classes).toMatch(/\bbg-/);
      expect(classes).toMatch(/\btext-/);
      expect(classes).toMatch(/\bring-/);
    }
  });
});
