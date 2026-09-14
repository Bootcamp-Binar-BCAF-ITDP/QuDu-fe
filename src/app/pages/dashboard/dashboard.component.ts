import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ChartData } from 'chart.js';
import {
  METRIC_ICONS,
  MetricCardComponent,
  TrendDirection,
} from '../../shared/components/chart/metric-card.component';
import {
  DASHBOARD_PERIODS,
  DashboardPeriod,
  DashboardResponse,
  MetricCard,
} from '../../models/dashboard/dashboard.models';
import {
  CHART_COLORS,
  doughnutChartOptions,
  lineChartOptions,
  verticalGradient,
} from '../../shared/components/chart/chart-theme';
import { ChartComponent } from '../../shared/components/chart/chart.component';
import { DashboardService } from '../../core/services/dashboard/dashboard.services';
import {
  CsvValue,
  csvDate,
  exportCsv as writeCsvFile,
  stampedFilename,
} from '../../shared/utils/csv-export.util';

const PERIOD_TEXT: Record<DashboardPeriod, { label: string; comparison: string }> = {
  THIS_MONTH: { label: 'This month', comparison: 'vs last month' },
  LAST_MONTH: { label: 'Last month', comparison: 'vs the month before' },
  LAST_7_DAYS: { label: 'Last 7 days', comparison: 'vs previous 7 days' },
  LAST_30_DAYS: { label: 'Last 30 days', comparison: 'vs previous 30 days' },
  THIS_YEAR: { label: 'This year', comparison: 'vs last year' },
};

type SummaryKey = keyof DashboardResponse['summary'];

interface CardDef {
  key: SummaryKey;
  label: string;
  money: boolean;
  invertTrend: boolean;
  iconPaths: readonly string[];
  tileClasses: string;
  iconClasses: string;
}

const CARD_DEFS: CardDef[] = [
  {
    key: 'totalApplications',
    label: 'Total Applications',
    money: false,
    invertTrend: false,
    iconPaths: METRIC_ICONS.document,
    tileClasses: 'bg-green-50',
    iconClasses: 'text-green-700',
  },
  {
    key: 'pending',
    label: 'Pending',
    money: false,
    invertTrend: false,
    iconPaths: METRIC_ICONS.clock,
    tileClasses: 'bg-amber-50',
    iconClasses: 'text-amber-600',
  },
  {
    key: 'approved',
    label: 'Approved',
    money: false,
    invertTrend: false,
    iconPaths: METRIC_ICONS.check,
    tileClasses: 'bg-blue-50',
    iconClasses: 'text-blue-600',
  },
  {
    key: 'rejected',
    label: 'Rejected',
    money: false,
    invertTrend: true,
    iconPaths: METRIC_ICONS.cross,
    tileClasses: 'bg-red-50',
    iconClasses: 'text-red-600',
  },
  {
    key: 'totalDisbursed',
    label: 'Total Disbursed',
    money: true,
    invertTrend: false,
    iconPaths: METRIC_ICONS.wallet,
    tileClasses: 'bg-green-50',
    iconClasses: 'text-green-700',
  },
];

const SLICE_COLORS: Record<string, string> = {
  pending: CHART_COLORS.amber,
  approved: CHART_COLORS.green,
  rejected: CHART_COLORS.red,
};

const COUNT_FORMAT = new Intl.NumberFormat('id-ID');

export interface CardView {
  key: SummaryKey;
  label: string;
  display: string;
  raw: number;
  change: number | null;
  direction: TrendDirection;
  invertTrend: boolean;
  iconPaths: string[];
  tileClasses: string;
  iconClasses: string;
}

export interface LegendEntry {
  label: string;
  color: string;
}

function shortDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return iso;
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [DatePipe, FormsModule, ChartComponent, MetricCardComponent],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent {
  private readonly service = inject(DashboardService);
  private readonly destroyRef = inject(DestroyRef);

  readonly periods = DASHBOARD_PERIODS;
  readonly period = signal<DashboardPeriod>('THIS_MONTH');

  readonly data = signal<DashboardResponse | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly fromDate = signal('');
  readonly toDate = signal('');

  readonly customRangeReady = computed(() => !!this.fromDate() && !!this.toDate());
  readonly customRangeActive = signal(false);

  readonly dateError = computed(() => {
    const from = this.fromDate();
    const to = this.toDate();
    if (from && to && from > to) return 'The start date is after the end date.';
    if ((from && !to) || (!from && to)) return 'Pick both dates to use a custom range.';
    return null;
  });

  readonly lineOptions = lineChartOptions();
  readonly donutOptions = doughnutChartOptions();

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    const custom = this.customRangeActive() && this.customRangeReady();

    this.service
      .getDashboard(
        this.period(),
        custom ? this.fromDate() : undefined,
        custom ? this.toDate() : undefined,
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.data.set(data);
          this.loading.set(false);
        },
        error: (err) => {
          this.data.set(null);
          this.error.set(this.errorMessage(err));
          this.loading.set(false);
        },
      });
  }

  exportCsv(): void {
    const data = this.data();
    if (!data) return;

    const rows: CsvValue[][] = [
      ['QuickDuit dashboard'],
      ['Period', this.windowLabel()],
      ['From', csvDate(data.from)],
      ['To', csvDate(data.to)],
      [],

      ['Summary'],
      ['Metric', 'Value', 'Change vs previous (%)', 'Direction'],
      ...this.cards().map((card) => [
        card.label,
        card.raw,
        card.change ?? '',
        card.direction ?? '',
      ]),
      [],

      ['Applications over time'],
      ['Date', 'All', 'Approved', 'Rejected', 'Pending'],
      ...data.applicationsOverTime.map((point) => [
        csvDate(point.date),
        point.all,
        point.approved,
        point.rejected,
        point.pending,
      ]),
      [],

      ['By status'],
      ['Status', 'Count', 'Share (%)'],
      ...data.byStatus.map((slice) => [slice.label, slice.count, slice.percentage]),
      ['Total', data.byStatusTotal, ''],
    ];

    const slug = this.customRangeActive()
      ? `${this.fromDate()}_${this.toDate()}`
      : this.period().toLowerCase();

    writeCsvFile(stampedFilename(`dashboard-${slug}`), rows);
  }

  changePeriod(period: DashboardPeriod): void {
    if (period === this.period() && !this.customRangeActive()) return;

    this.period.set(period);
    this.customRangeActive.set(false);
    this.load();
  }

  applyCustomRange(): void {
    if (!this.customRangeReady() || this.dateError()) return;
    this.customRangeActive.set(true);
    this.load();
  }

  clearCustomRange(): void {
    if (!this.customRangeActive() && !this.fromDate() && !this.toDate()) return;

    this.fromDate.set('');
    this.toDate.set('');
    this.customRangeActive.set(false);
    this.load();
  }

  readonly windowLabel = computed(() => {
    if (!this.customRangeActive()) return this.periodLabel(this.period());
    return `${this.fromDate()} to ${this.toDate()}`;
  });

  periodLabel(period: DashboardPeriod): string {
    return PERIOD_TEXT[period].label;
  }

  readonly comparisonLabel = computed(() => PERIOD_TEXT[this.period()].comparison);

  private errorMessage(err: unknown): string {
    const error = err as { status?: number; error?: { message?: string } };

    if (error?.error?.message) return error.error.message;

    switch (error?.status) {
      case 0:
        return 'No connection to the server. Check your network and try again.';
      case 401:
        return 'Your session expired. Sign in again.';
      case 403:
        return 'Your role cannot see the dashboard.';
      default:
        return 'Could not load the dashboard. Retry in a moment.';
    }
  }

  readonly cards = computed<CardView[]>(() => {
    const summary = this.data()?.summary;
    if (!summary) return [];

    return CARD_DEFS.map((def) => {
      const metric: MetricCard = summary[def.key];

      return {
        key: def.key,
        label: def.label,
        display: def.money
          ? this.compactRupiah(metric?.value ?? 0)
          : COUNT_FORMAT.format(metric?.value ?? 0),
        raw: metric?.value ?? 0,
        change: metric?.changePercent ?? null,
        direction: (metric?.direction ?? 'FLAT') as TrendDirection,
        invertTrend: def.invertTrend,
        iconPaths: [...def.iconPaths],
        tileClasses: def.tileClasses,
        iconClasses: def.iconClasses,
      };
    });
  });

  readonly lineData = computed<ChartData<'line'>>(() => {
    const points = this.data()?.applicationsOverTime ?? [];

    return {
      labels: points.map((point) => shortDate(point.date)),
      datasets: [
        {
          label: 'All',
          data: points.map((point) => point.all),
          borderColor: CHART_COLORS.green,
          pointBackgroundColor: CHART_COLORS.green,
          backgroundColor: verticalGradient(CHART_COLORS.green),
          fill: true,
        },
        {
          label: 'Approved',
          data: points.map((point) => point.approved),
          borderColor: CHART_COLORS.blue,
          pointBackgroundColor: CHART_COLORS.blue,
          fill: false,
        },
        {
          label: 'Rejected',
          data: points.map((point) => point.rejected),
          borderColor: CHART_COLORS.red,
          pointBackgroundColor: CHART_COLORS.red,
          fill: false,
        },
        {
          label: 'Pending',
          data: points.map((point) => point.pending),
          borderColor: CHART_COLORS.amber,
          pointBackgroundColor: CHART_COLORS.amber,
          fill: false,
        },
      ],
    };
  });

  readonly lineLegend = computed<LegendEntry[]>(() =>
    this.lineData().datasets.map((dataset) => ({
      label: dataset.label ?? '',
      color: String(dataset.borderColor ?? CHART_COLORS.slate),
    })),
  );

  readonly hasSeries = computed(() => (this.data()?.applicationsOverTime.length ?? 0) > 0);

  readonly donutData = computed<ChartData<'doughnut'>>(() => {
    const slices = this.data()?.byStatus ?? [];

    return {
      labels: slices.map((slice) => slice.label),
      datasets: [
        {
          data: slices.map((slice) => slice.count),
          backgroundColor: slices.map((slice) => SLICE_COLORS[slice.key] ?? CHART_COLORS.slate),
          borderWidth: 0,
          hoverOffset: 6,
        },
      ],
    };
  });

  readonly donutTotal = computed(() => this.data()?.byStatusTotal ?? 0);

  formatCount(value: number | null | undefined): string {
    return value == null ? '—' : COUNT_FORMAT.format(value);
  }

  sliceColor(key: string): string {
    return SLICE_COLORS[key] ?? CHART_COLORS.slate;
  }

  compactRupiah(value: number | null | undefined): string {
    if (value == null) return '—';

    const units: [number, string][] = [
      [1e12, 'T'],
      [1e9, 'M'],
      [1e6, 'jt'],
      [1e3, 'rb'],
    ];

    const absolute = Math.abs(value);

    for (const [size, suffix] of units) {
      if (absolute >= size) {
        const scaled = value / size;
        const digits = Math.abs(scaled) >= 100 ? 0 : 2;
        return `Rp ${scaled.toFixed(digits).replace('.', ',')} ${suffix}`;
      }
    }

    return `Rp ${COUNT_FORMAT.format(Math.round(value))}`;
  }
}
