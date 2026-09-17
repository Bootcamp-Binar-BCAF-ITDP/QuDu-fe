import { ScriptableContext, TooltipItem } from 'chart.js';

import {
  CHART_COLORS,
  doughnutChartOptions,
  lineChartOptions,
  sparsePointRadius,
  verticalGradient,
} from './chart-theme';

const lineContext = (over: Record<string, unknown> = {}) =>
  ({
    dataIndex: 0,
    chart: { data: { labels: [] }, ...(over['chart'] as object) },
    ...over,
  }) as unknown as ScriptableContext<'line'>;

const pointContext = (dataIndex: number, labelCount: number) =>
  ({
    dataIndex,
    chart: { data: { labels: new Array(labelCount).fill('x') } },
  }) as unknown as ScriptableContext<'line'>;

describe('CHART_COLORS', () => {
  it('gives every series a six digit hex colour', () => {
    for (const [name, value] of Object.entries(CHART_COLORS)) {
      expect(value, name).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it('uses no colour twice, so two series never look identical', () => {
    const values = Object.values(CHART_COLORS);
    expect(new Set(values).size).toBe(values.length);
  });

  it('keeps green for approved and red for rejected, matching the status chips', () => {
    expect(CHART_COLORS.green).toBe('#16A34A');
    expect(CHART_COLORS.red).toBe('#DC2626');
  });
});

describe('sparsePointRadius', () => {
  const radius = (dataIndex: number, labelCount: number, target?: number) =>
    sparsePointRadius(target)(pointContext(dataIndex, labelCount));

  it('draws nothing when the chart has no points at all', () => {
    expect(radius(0, 0)).toBe(0);
  });

  it('marks every point when there are fewer than the target', () => {
    for (let i = 0; i < 5; i++) {
      expect(radius(i, 5)).toBe(3);
    }
  });

  it('thins the markers once the series is longer than the target', () => {
    const shown = Array.from({ length: 30 }, (_, i) => radius(i, 30)).filter((r) => r > 0);

    expect(shown.length).toBeLessThan(30);
    expect(shown.length).toBeGreaterThan(0);
  });

  it('always marks the first point', () => {
    expect(radius(0, 100)).toBe(3);
  });

  it('always marks the last point, so the line never ends bare', () => {
    expect(radius(99, 100)).toBe(3);
  });

  it('honours a different target', () => {
    const few = Array.from({ length: 40 }, (_, i) => radius(i, 40, 4)).filter((r) => r > 0);
    const many = Array.from({ length: 40 }, (_, i) => radius(i, 40, 20)).filter((r) => r > 0);

    expect(few.length).toBeLessThan(many.length);
  });

  it('treats a missing labels array as an empty chart', () => {
    const context = { dataIndex: 0, chart: { data: {} } } as unknown as ScriptableContext<'line'>;
    expect(sparsePointRadius()(context)).toBe(0);
  });
});

describe('verticalGradient', () => {
  it('returns transparent before the chart has been laid out', () => {
    const context = lineContext({ chart: { data: { labels: [] }, chartArea: null } });
    expect(verticalGradient(CHART_COLORS.green)(context)).toBe('transparent');
  });

  it('builds a top to bottom gradient once the area is known', () => {
    const stops: [number, string][] = [];
    const gradient = { addColorStop: (o: number, c: string) => stops.push([o, c]) };
    const created: number[][] = [];

    const context = {
      chart: {
        data: { labels: [] },
        chartArea: { top: 10, bottom: 210 },
        ctx: {
          createLinearGradient: (...args: number[]) => {
            created.push(args);
            return gradient;
          },
        },
      },
    } as unknown as ScriptableContext<'line'>;

    const result = verticalGradient(CHART_COLORS.blue, 0.2)(context);

    expect(created[0]).toEqual([0, 10, 0, 210]);
    expect(result).toBe(gradient);
    expect(stops[0]).toEqual([0, 'rgba(37, 99, 235, 0.2)']);
    expect(stops[1]).toEqual([1, 'rgba(37, 99, 235, 0)']);
  });

  it('fades to fully transparent at the bottom whatever the opacity', () => {
    const stops: [number, string][] = [];
    const gradient = { addColorStop: (o: number, c: string) => stops.push([o, c]) };

    const context = {
      chart: {
        data: { labels: [] },
        chartArea: { top: 0, bottom: 100 },
        ctx: { createLinearGradient: () => gradient },
      },
    } as unknown as ScriptableContext<'line'>;

    verticalGradient(CHART_COLORS.red, 0.9)(context);

    expect(stops[1][1]).toContain(', 0)');
  });
});

describe('lineChartOptions', () => {
  it('lets the container decide the size, which is what makes the card responsive', () => {
    const options = lineChartOptions();

    expect(options.responsive).toBe(true);
    expect(options.maintainAspectRatio).toBe(false);
  });

  it('hides the built-in legend, because the card draws its own', () => {
    expect(lineChartOptions().plugins?.legend?.display).toBe(false);
  });

  it('shows every series at the hovered x, not just the nearest point', () => {
    const options = lineChartOptions();

    expect(options.interaction?.mode).toBe('index');
    expect(options.interaction?.intersect).toBe(false);
  });

  it('starts the y axis at zero, so a small change cannot look like a cliff', () => {
    expect((lineChartOptions().scales?.['y'] as { beginAtZero?: boolean })?.beginAtZero).toBe(true);
  });

  it('formats tooltip counts in Indonesian grouping', () => {
    const callback = lineChartOptions().plugins?.tooltip?.callbacks?.label as (
      item: TooltipItem<'line'>,
    ) => string;

    const label = callback({
      dataset: { label: 'Approved' },
      parsed: { y: 1234567 },
    } as unknown as TooltipItem<'line'>);

    expect(label).toContain('Approved');
    expect(label).toContain('1.234.567');
  });

  it('formats axis ticks the same way', () => {
    const ticks = (lineChartOptions().scales?.['y'] as { ticks?: { callback?: Function } })?.ticks;
    const callback = ticks?.callback as (value: unknown) => string;

    expect(callback(1000)).toBe('1.000');
  });

  it('lets a caller override a top level option', () => {
    expect(lineChartOptions({ responsive: false }).responsive).toBe(false);
  });

  it('replaces a whole section when overridden, rather than merging into it', () => {
    const options = lineChartOptions({ plugins: { legend: { display: true } } });

    expect(options.plugins?.legend?.display).toBe(true);
    expect(options.plugins?.tooltip).toBeUndefined();
  });
});

describe('doughnutChartOptions', () => {
  const shareLabel = (value: number, data: unknown[]) => {
    const callback = doughnutChartOptions().plugins?.tooltip?.callbacks?.label as (
      item: TooltipItem<'doughnut'>,
    ) => string;

    return callback({
      label: 'Approved',
      parsed: value,
      dataset: { data },
    } as unknown as TooltipItem<'doughnut'>);
  };

  it('leaves a hole in the middle for the total', () => {
    expect(doughnutChartOptions().cutout).toBe('68%');
  });

  it('shows the count and its share of the total', () => {
    expect(shareLabel(25, [25, 75])).toBe(' Approved: 25 (25.0%)');
  });

  it('shows one decimal place, so a small slice is not rounded to nothing', () => {
    expect(shareLabel(1, [1, 999])).toContain('(0.1%)');
  });

  it('says zero percent instead of NaN when every slice is zero', () => {
    expect(shareLabel(0, [0, 0])).toContain('(0.0%)');
  });

  it('says zero percent for an empty dataset', () => {
    expect(shareLabel(0, [])).toContain('(0.0%)');
  });

  it('treats a null entry as zero rather than breaking the total', () => {
    expect(shareLabel(50, [50, null, 50])).toContain('(50.0%)');
  });

  it('groups the count in Indonesian format', () => {
    expect(shareLabel(1500, [1500, 1500])).toContain('1.500');
  });

  it('hides the built-in legend', () => {
    expect(doughnutChartOptions().plugins?.legend?.display).toBe(false);
  });

  it('lets a caller override the cutout', () => {
    expect(doughnutChartOptions({ cutout: '50%' }).cutout).toBe('50%');
  });
});
