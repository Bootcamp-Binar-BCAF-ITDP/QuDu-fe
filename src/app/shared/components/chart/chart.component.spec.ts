import { ComponentFixture, TestBed } from '@angular/core/testing';

const harness = vi.hoisted(() => {
  const instances: {
    config: { type: string };
    data: unknown;
    options: unknown;
    updates: number;
    destroyed: boolean;
  }[] = [];

  class FakeChart {
    static register = (..._args: unknown[]) => undefined;

    config: { type: string };
    data: unknown;
    options: unknown;
    updates = 0;
    destroyed = false;

    constructor(
      public canvas: unknown,
      config: { type: string; data: unknown; options: unknown },
    ) {
      this.config = { type: config.type };
      this.data = config.data;
      this.options = config.options;
      instances.push(this);
    }

    update() {
      this.updates += 1;
    }

    destroy() {
      this.destroyed = true;
    }
  }

  return { instances, FakeChart };
});

vi.mock('chart.js', () => ({
  Chart: harness.FakeChart,
  ArcElement: class {},
  BarController: class {},
  BarElement: class {},
  CategoryScale: class {},
  DoughnutController: class {},
  Filler: class {},
  Legend: class {},
  LineController: class {},
  LineElement: class {},
  LinearScale: class {},
  PieController: class {},
  PointElement: class {},
  Tooltip: class {},
}));

const { ChartComponent } = await import('./chart.component');

const lineData = (values: number[]) => ({
  labels: values.map((_, i) => `d${i}`),
  datasets: [{ label: 'All', data: values }],
});

describe('ChartComponent', () => {
  let fixture: ComponentFixture<InstanceType<typeof ChartComponent>>;

  const latest = () => harness.instances[harness.instances.length - 1];

  const set = (inputs: Record<string, unknown>) => {
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
  };

  beforeEach(async () => {
    harness.instances.length = 0;

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [ChartComponent] }).compileComponents();

    fixture = TestBed.createComponent(ChartComponent);
    set({ type: 'line', data: lineData([1, 2, 3]) });
  });

  it('builds one chart on the canvas it owns', () => {
    expect(harness.instances).toHaveLength(1);
    expect(latest().config.type).toBe('line');
  });

  it('passes the data straight through', () => {
    expect(latest().data).toMatchObject({ datasets: [{ label: 'All' }] });
  });

  it('passes an empty options object when the caller gives none', () => {
    expect(latest().options).toEqual({});
  });

  it('passes the caller options when given', () => {
    harness.instances.length = 0;

    const other = TestBed.createComponent(ChartComponent);
    other.componentRef.setInput('type', 'line');
    other.componentRef.setInput('data', lineData([1]));
    other.componentRef.setInput('options', { responsive: false });
    other.detectChanges();

    expect(latest().options).toEqual({ responsive: false });
  });

  it('updates the existing chart when only the data changes, rather than rebuilding it', () => {
    const first = latest();

    set({ data: lineData([4, 5, 6]) });

    expect(harness.instances).toHaveLength(1);
    expect(first.updates).toBe(1);
    expect(first.destroyed).toBe(false);
  });

  it('keeps the new data on the same chart', () => {
    set({ data: lineData([9]) });

    expect(latest().data).toMatchObject({ labels: ['d0'] });
  });

  it('rebuilds from scratch when the chart type changes, because chart.js cannot switch', () => {
    const first = latest();

    set({ type: 'doughnut' });

    expect(first.destroyed).toBe(true);
    expect(harness.instances).toHaveLength(2);
    expect(latest().config.type).toBe('doughnut');
  });

  it('destroys the chart when the component goes away, so the canvas is released', () => {
    const chart = latest();

    fixture.destroy();

    expect(chart.destroyed).toBe(true);
  });

  it('builds no second chart after being destroyed', () => {
    fixture.destroy();
    expect(harness.instances).toHaveLength(1);
  });

  it('labels the canvas for screen readers, since a chart is an image to them', () => {
    const canvas = (fixture.nativeElement as HTMLElement).querySelector('canvas')!;

    expect(canvas.getAttribute('role')).toBe('img');
    expect(canvas.getAttribute('aria-label')).toBe('Chart');
  });

  it('takes a caller supplied label', () => {
    set({ ariaLabel: 'Applications over time' });

    const canvas = (fixture.nativeElement as HTMLElement).querySelector('canvas')!;
    expect(canvas.getAttribute('aria-label')).toBe('Applications over time');
  });
});
