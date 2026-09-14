import { ChartOptions, ScriptableContext, TooltipItem } from 'chart.js';

export const CHART_COLORS = {
  green: '#16A34A',
  blue: '#2563EB',
  red: '#DC2626',
  amber: '#F59E0B',
  indigo: '#4F46E5',
  slate: '#94A3B8',
} as const;

const GRID = '#F1F5F9';
const AXIS_TEXT = '#94A3B8';
const TOOLTIP_BG = '#0F172A';

const FONT_FAMILY =
  "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

const COUNT_FORMAT = new Intl.NumberFormat('id-ID');

function hexToRgba(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function verticalGradient(color: string, opacity = 0.18) {
  return (context: ScriptableContext<'line'>): CanvasGradient | string => {
    const { ctx, chartArea } = context.chart;
    if (!chartArea) return 'transparent';

    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
    gradient.addColorStop(0, hexToRgba(color, opacity));
    gradient.addColorStop(1, hexToRgba(color, 0));
    return gradient;
  };
}

export function sparsePointRadius(target = 8) {
  return (context: ScriptableContext<'line'>): number => {
    const count = context.chart.data.labels?.length ?? 0;
    if (count === 0) return 0;

    const stride = Math.max(1, Math.ceil(count / target));
    const isMarker = context.dataIndex % stride === 0 || context.dataIndex === count - 1;
    return isMarker ? 3 : 0;
  };
}

export function lineChartOptions(
  overrides: ChartOptions<'line'> = {},
): ChartOptions<'line'> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    elements: {
      line: { tension: 0.35, borderWidth: 2 },
      point: {
        radius: sparsePointRadius(),
        hoverRadius: 5,
        hitRadius: 12,
        borderWidth: 0,
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: TOOLTIP_BG,
        padding: 10,
        cornerRadius: 8,
        boxPadding: 4,
        titleFont: { family: FONT_FAMILY, size: 12 },
        bodyFont: { family: FONT_FAMILY, size: 12 },
        callbacks: {
          label: (item: TooltipItem<'line'>) =>
            ` ${item.dataset.label}: ${COUNT_FORMAT.format(Number(item.parsed.y))}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: {
          color: AXIS_TEXT,
          font: { family: FONT_FAMILY, size: 11 },
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 8,
        },
      },
      y: {
        beginAtZero: true,
        grid: { color: GRID },
        border: { display: false },
        ticks: {
          color: AXIS_TEXT,
          font: { family: FONT_FAMILY, size: 11 },
          maxTicksLimit: 6,
          callback: (value) => COUNT_FORMAT.format(Number(value)),
        },
      },
    },
    ...overrides,
  };
}

export function doughnutChartOptions(
  overrides: ChartOptions<'doughnut'> = {},
): ChartOptions<'doughnut'> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: TOOLTIP_BG,
        padding: 10,
        cornerRadius: 8,
        titleFont: { family: FONT_FAMILY, size: 12 },
        bodyFont: { family: FONT_FAMILY, size: 12 },
        callbacks: {
          label: (item: TooltipItem<'doughnut'>) => {
            const value = Number(item.parsed);
            const total = item.dataset.data.reduce(
              (sum: number, entry) => sum + Number(entry ?? 0),
              0,
            );
            const share = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
            return ` ${item.label}: ${COUNT_FORMAT.format(value)} (${share}%)`;
          },
        },
      },
    },
    ...overrides,
  };
}
