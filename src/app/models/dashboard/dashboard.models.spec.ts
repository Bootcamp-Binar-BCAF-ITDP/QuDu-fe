import { DASHBOARD_PERIODS, DashboardPeriod } from './dashboard.models';

describe('DASHBOARD_PERIODS', () => {
  it('offers the five ranges the dashboard tabs show', () => {
    expect(DASHBOARD_PERIODS).toEqual([
      'THIS_MONTH',
      'LAST_MONTH',
      'LAST_7_DAYS',
      'LAST_30_DAYS',
      'THIS_YEAR',
    ]);
  });

  it('lists none twice', () => {
    expect(new Set(DASHBOARD_PERIODS).size).toBe(DASHBOARD_PERIODS.length);
  });

  it('spells every period in the screaming snake case the backend parses', () => {
    for (const period of DASHBOARD_PERIODS) {
      expect(period).toMatch(/^[A-Z0-9_]+$/);
    }
  });

  it('is the single source the DashboardPeriod type is derived from', () => {
    const period: DashboardPeriod = DASHBOARD_PERIODS[0];
    expect(DASHBOARD_PERIODS).toContain(period);
  });

  it('holds no custom range, because a custom range travels as from and to instead', () => {
    expect(DASHBOARD_PERIODS as readonly string[]).not.toContain('CUSTOM');
  });
});
