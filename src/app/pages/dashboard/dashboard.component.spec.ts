import { TestBed } from '@angular/core/testing';
import { Subject, throwError } from 'rxjs';

import { DashboardService } from '../../core/services/dashboard/dashboard.services';
import { DashboardComponent } from './dashboard.component';

const downloads: { name: string; blob: Blob }[] = [];

const ORIGINAL_CREATE_ELEMENT = document.createElement.bind(document);

const captureDownloads = () => {
  downloads.length = 0;

  URL.createObjectURL = vi.fn((blob: Blob) => {
    downloads.push({ name: '', blob });
    return 'blob:stub';
  }) as unknown as typeof URL.createObjectURL;

  URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL;

  document.createElement = ((tag: string) => {
    const el = ORIGINAL_CREATE_ELEMENT(tag);
    if (tag === 'a') {
      (el as HTMLAnchorElement).click = () => {
        const last = downloads[downloads.length - 1];
        if (last) last.name = (el as HTMLAnchorElement).download;
      };
    }
    return el;
  }) as typeof document.createElement;
};

const releaseDownloads = () => {
  document.createElement = ORIGINAL_CREATE_ELEMENT as typeof document.createElement;
};

const metric = (value: number, changePercent: number | null = null, direction = 'FLAT') => ({
  value,
  changePercent,
  direction,
});

const dashboard = (over: Record<string, unknown> = {}) => ({
  from: '2026-09-01T00:00:00Z',
  to: '2026-09-30T23:59:59Z',
  summary: {
    totalApplications: metric(120, 10, 'UP'),
    pending: metric(30),
    approved: metric(60, 5, 'UP'),
    rejected: metric(30, -2, 'DOWN'),
    totalDisbursed: metric(4_500_000_000, 12, 'UP'),
  },
  applicationsOverTime: [
    { date: '2026-09-01T00:00:00Z', all: 5, approved: 3, rejected: 1, pending: 1 },
    { date: '2026-09-02T00:00:00Z', all: 8, approved: 4, rejected: 2, pending: 2 },
  ],
  byStatus: [
    { key: 'approved', label: 'Approved', count: 60, percentage: 50 },
    { key: 'rejected', label: 'Rejected', count: 30, percentage: 25 },
  ],
  byStatusTotal: 120,
  ...over,
});

describe('DashboardComponent', () => {
  let component: DashboardComponent;

  let calls: unknown[][];
  let data$: Subject<any>;
  let failWith: unknown = null;

  const build = () => {
    TestBed.resetTestingModule();

    calls = [];
    data$ = new Subject<any>();
    failWith = null;
    captureDownloads();

    TestBed.configureTestingModule({
      providers: [
        {
          provide: DashboardService,
          useValue: {
            getDashboard: (...args: unknown[]) => {
              calls.push(args);
              return failWith ? throwError(() => failWith) : data$.asObservable();
            },
          },
        },
      ],
    });

    component = TestBed.runInInjectionContext(() => new DashboardComponent());
  };

  const loaded = (over: Record<string, unknown> = {}) => {
    data$.next(dashboard(over));
  };

  beforeEach(() => build());

  afterEach(() => releaseDownloads());

  describe('loading', () => {
    it('loads this month as soon as it is created', () => {
      expect(calls).toHaveLength(1);
      expect(calls[0][0]).toBe('THIS_MONTH');
      expect(component.loading()).toBe(true);
    });

    it('sends no custom range unless one is active', () => {
      expect(calls[0][1]).toBeUndefined();
      expect(calls[0][2]).toBeUndefined();
    });

    it('keeps the response and stops spinning', () => {
      loaded();

      expect(component.data()).not.toBeNull();
      expect(component.loading()).toBe(false);
      expect(component.error()).toBeNull();
    });

    it('drops the data and explains a failure', () => {
      loaded();
      failWith = { status: 500 };

      component.load();

      expect(component.data()).toBeNull();
      expect(component.error()).toContain('Could not load the dashboard');
    });

    it('names the cause for the failures a user can act on', () => {
      const cases: [unknown, string][] = [
        [{ status: 0 }, 'No connection'],
        [{ status: 401 }, 'session expired'],
        [{ status: 403 }, 'role cannot see'],
      ];

      for (const [error, expected] of cases) {
        build();
        failWith = error;
        component.load();

        expect(component.error()).toContain(expected);
      }
    });

    it('prefers a message the server sent over its own wording', () => {
      failWith = { status: 500, error: { message: 'Report engine offline.' } };
      component.load();

      expect(component.error()).toBe('Report engine offline.');
    });
  });

  describe('the period tabs', () => {
    it('reloads when a different period is chosen', () => {
      component.changePeriod('LAST_7_DAYS');

      expect(component.period()).toBe('LAST_7_DAYS');
      expect(calls).toHaveLength(2);
      expect(calls[1][0]).toBe('LAST_7_DAYS');
    });

    it('ignores a click on the period already showing', () => {
      component.changePeriod('THIS_MONTH');
      expect(calls).toHaveLength(1);
    });

    it('does reload the same period when it clears an active custom range', () => {
      component.fromDate.set('2026-09-01');
      component.toDate.set('2026-09-15');
      component.applyCustomRange();

      component.changePeriod('THIS_MONTH');

      expect(component.customRangeActive()).toBe(false);
      expect(calls).toHaveLength(3);
    });

    it('labels every period for the header', () => {
      for (const period of component.periods) {
        expect(component.periodLabel(period).trim()).not.toBe('');
      }
    });
  });

  describe('the custom range', () => {
    it('needs both ends before it can be applied', () => {
      component.fromDate.set('2026-09-01');

      expect(component.customRangeReady()).toBe(false);
      expect(component.dateError()).toContain('Pick both dates');
    });

    it('complains when the start is after the end', () => {
      component.fromDate.set('2026-09-30');
      component.toDate.set('2026-09-01');

      expect(component.dateError()).toContain('after the end date');
    });

    it('is happy with a valid range', () => {
      component.fromDate.set('2026-09-01');
      component.toDate.set('2026-09-30');

      expect(component.dateError()).toBeNull();
      expect(component.customRangeReady()).toBe(true);
    });

    it('refuses to apply an incomplete range', () => {
      component.fromDate.set('2026-09-01');
      component.applyCustomRange();

      expect(calls).toHaveLength(1);
      expect(component.customRangeActive()).toBe(false);
    });

    it('sends both dates once applied', () => {
      component.fromDate.set('2026-09-01');
      component.toDate.set('2026-09-15');
      component.applyCustomRange();

      expect(calls[1]).toEqual(['THIS_MONTH', '2026-09-01', '2026-09-15']);
    });

    it('clears back to the period view', () => {
      component.fromDate.set('2026-09-01');
      component.toDate.set('2026-09-15');
      component.applyCustomRange();

      component.clearCustomRange();

      expect(component.fromDate()).toBe('');
      expect(component.customRangeActive()).toBe(false);
      expect(calls[2][1]).toBeUndefined();
    });

    it('does not reload when there was no range to clear', () => {
      component.clearCustomRange();
      expect(calls).toHaveLength(1);
    });

    it('labels the window by period, or by the dates when a range is active', () => {
      expect(component.windowLabel()).toBe(component.periodLabel('THIS_MONTH'));

      component.fromDate.set('2026-09-01');
      component.toDate.set('2026-09-15');
      component.applyCustomRange();

      expect(component.windowLabel()).toBe('2026-09-01 to 2026-09-15');
    });
  });

  describe('the metric cards', () => {
    it('shows none before any data arrives', () => {
      expect(component.cards()).toEqual([]);
    });

    it('builds one card per summary metric', () => {
      loaded();
      expect(component.cards()).toHaveLength(5);
    });

    it('gives every card a label and a display string', () => {
      loaded();

      for (const card of component.cards()) {
        expect(card.label.trim()).not.toBe('');
        expect(card.display.trim()).not.toBe('');
      }
    });

    it('gives every card an icon and its own tile colours', () => {
      loaded();

      for (const card of component.cards()) {
        expect(card.iconPaths.length).toBeGreaterThan(0);
        expect(card.tileClasses.trim()).not.toBe('');
      }
    });

    it('marks rejections as a metric where a rise is bad', () => {
      loaded();

      const rejected = component.cards().find((c) => c.key === 'rejected')!;
      expect(rejected.invertTrend).toBe(true);
    });

    it('keeps the raw number alongside the formatted one, for the export', () => {
      loaded();

      const total = component.cards().find((c) => c.label.toLowerCase().includes('total'))!;
      expect(typeof total.raw).toBe('number');
    });
  });

  describe('the charts', () => {
    it('reports no series before data arrives', () => {
      expect(component.hasSeries()).toBe(false);
    });

    it('reports a series once points arrive', () => {
      loaded();
      expect(component.hasSeries()).toBe(true);
    });

    it('reports no series for an empty time list', () => {
      loaded({ applicationsOverTime: [] });
      expect(component.hasSeries()).toBe(false);
    });

    it('builds one line dataset per tracked outcome', () => {
      loaded();
      expect(component.lineData().datasets.length).toBeGreaterThan(0);
    });

    it('gives the legend an entry per dataset', () => {
      loaded();
      expect(component.lineLegend()).toHaveLength(component.lineData().datasets.length);
    });

    it('builds the doughnut from the status slices', () => {
      loaded();

      expect(component.donutData().labels).toEqual(['Approved', 'Rejected']);
      expect(component.donutTotal()).toBe(120);
    });

    it('reports a zero total before data arrives', () => {
      expect(component.donutTotal()).toBe(0);
    });

    it('falls back to a neutral colour for an unknown status key', () => {
      expect(component.sliceColor('something-new')).toBe(component.sliceColor('also-unknown'));
    });
  });

  describe('the number formatters', () => {
    it('groups counts in Indonesian style', () => {
      expect(component.formatCount(1234567)).toBe('1.234.567');
    });

    it('shows a dash for a missing count', () => {
      expect(component.formatCount(null)).toBe('—');
      expect(component.formatCount(undefined)).toBe('—');
    });

    it('abbreviates large rupiah amounts with Indonesian units', () => {
      expect(component.compactRupiah(4_500_000_000)).toBe('Rp 4,50 M');
      expect(component.compactRupiah(2_500_000)).toBe('Rp 2,50 jt');
      expect(component.compactRupiah(1_500)).toBe('Rp 1,50 rb');
    });

    it('drops the decimals once the scaled figure reaches three digits', () => {
      expect(component.compactRupiah(150_000_000_000)).toBe('Rp 150 M');
    });

    it('writes a small amount in full', () => {
      expect(component.compactRupiah(750)).toBe('Rp 750');
    });

    it('uses a comma for the decimal, as Indonesian does', () => {
      expect(component.compactRupiah(2_500_000)).toContain(',');
      expect(component.compactRupiah(2_500_000)).not.toContain('.');
    });

    it('shows a dash for a missing amount', () => {
      expect(component.compactRupiah(null)).toBe('—');
    });

    it('handles a negative amount without losing the sign', () => {
      expect(component.compactRupiah(-2_500_000)).toContain('-2,50');
    });
  });

  describe('exporting', () => {
    it('writes nothing before any data has arrived', () => {
      component.exportCsv();
      expect(downloads).toEqual([]);
    });

    it('writes a file once there is data', () => {
      loaded();
      component.exportCsv();

      expect(downloads).toHaveLength(1);
    });

    it('names the file after the period', () => {
      loaded();
      component.exportCsv();

      expect(downloads[0].name).toContain('dashboard-this_month');
    });

    it('names it after the dates when a custom range is active', () => {
      component.fromDate.set('2026-09-01');
      component.toDate.set('2026-09-15');
      component.applyCustomRange();
      loaded();

      component.exportCsv();

      expect(downloads[0].name).toContain('dashboard-2026-09-01_2026-09-15');
    });

    it('writes all three sections, so one file explains the whole screen', async () => {
      loaded();
      component.exportCsv();

      const text = await downloads[0].blob.text();
      expect(text).toContain('Summary');
      expect(text).toContain('Applications over time');
      expect(text).toContain('By status');
    });

    it('writes only the date half of the window timestamps', async () => {
      loaded();
      component.exportCsv();

      const text = await downloads[0].blob.text();
      expect(text).toContain('2026-09-01');
      expect(text).not.toContain('T00:00:00Z');
    });

    it('writes the raw numbers rather than the abbreviated display strings', async () => {
      loaded();
      component.exportCsv();

      const text = await downloads[0].blob.text();
      expect(text).toContain('4500000000');
      expect(text).not.toContain('Rp 4,50 M');
    });

    it('closes the status section with a total row', async () => {
      loaded();
      component.exportCsv();

      const text = await downloads[0].blob.text();
      expect(text).toContain('Total,120');
    });

    it('writes an empty cell rather than a word for a metric with no comparison', async () => {
      loaded();
      component.exportCsv();

      const text = await downloads[0].blob.text();
      expect(text).not.toContain('undefined');
      expect(text).not.toContain('null');
    });
  });
});
