/* Mirrors com.delvin.loan.dto.response.dashboard.DashboardResponse. */

export const DASHBOARD_PERIODS = [
  'THIS_MONTH',
  'LAST_MONTH',
  'LAST_7_DAYS',
  'LAST_30_DAYS',
  'THIS_YEAR',
] as const;

export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];

export type TrendDirection = 'UP' | 'DOWN' | 'FLAT';

export interface MetricCard {
  value: number;
  /** Null when the previous period had nothing to compare against. */
  changePercent: number | null;
  direction: TrendDirection;
}

export interface DashboardSummary {
  totalApplications: MetricCard;
  pending: MetricCard;
  approved: MetricCard;
  rejected: MetricCard;
  totalDisbursed: MetricCard;
}

/** Running totals — every series only ever rises across the period. */
export interface TimeSeriesPoint {
  /** e.g. '2026-05-01' */
  date: string;
  all: number;
  approved: number;
  rejected: number;
  pending: number;
}

export interface StatusSlice {
  /** 'pending' | 'approved' | 'rejected' */
  key: string;
  label: string;
  count: number;
  percentage: number;
}

export interface DashboardResponse {
  from: string;
  to: string;
  summary: DashboardSummary;
  applicationsOverTime: TimeSeriesPoint[];
  byStatus: StatusSlice[];
  byStatusTotal: number;
}
