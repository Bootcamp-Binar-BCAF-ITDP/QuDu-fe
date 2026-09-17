import { ComponentFixture, TestBed } from '@angular/core/testing';

import { METRIC_ICONS, MetricCardComponent } from './metric-card.component';

describe('MetricCardComponent', () => {
  let fixture: ComponentFixture<MetricCardComponent>;
  let card: MetricCardComponent;

  const set = (inputs: Record<string, unknown>) => {
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
  };

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [MetricCardComponent] }).compileComponents();

    fixture = TestBed.createComponent(MetricCardComponent);
    card = fixture.componentInstance;

    set({ label: 'Total applications', value: '128' });
  });

  describe('changeLabel', () => {
    it('is absent when the backend sent no comparison', () => {
      expect(card.changeLabel()).toBeNull();
    });

    it('writes the decimal with a comma, the Indonesian convention', () => {
      set({ change: 12.5 });
      expect(card.changeLabel()).toBe('12,5%');
    });

    it('always shows one decimal place', () => {
      set({ change: 12 });
      expect(card.changeLabel()).toBe('12,0%');
    });

    it('drops the sign, because the arrow already shows the direction', () => {
      set({ change: -12.5 });
      expect(card.changeLabel()).toBe('12,5%');
    });

    it('renders a zero change rather than hiding it', () => {
      set({ change: 0 });
      expect(card.changeLabel()).toBe('0,0%');
    });

    it('rounds to one place', () => {
      set({ change: 33.333 });
      expect(card.changeLabel()).toBe('33,3%');
    });
  });

  describe('trendClasses', () => {
    it('is grey when nothing moved', () => {
      set({ direction: 'FLAT' });
      expect(card.trendClasses()).toContain('slate');
    });

    it('is green for a rise and red for a fall on an ordinary metric', () => {
      set({ direction: 'UP' });
      expect(card.trendClasses()).toContain('green');

      set({ direction: 'DOWN' });
      expect(card.trendClasses()).toContain('red');
    });

    it('swaps the colours when a rise is bad, as for rejections', () => {
      set({ invertTrend: true, direction: 'UP' });
      expect(card.trendClasses()).toContain('red');

      set({ invertTrend: true, direction: 'DOWN' });
      expect(card.trendClasses()).toContain('green');
    });

    it('stays grey when flat even on an inverted metric', () => {
      set({ invertTrend: true, direction: 'FLAT' });
      expect(card.trendClasses()).toContain('slate');
    });
  });

  describe('what it renders', () => {
    const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

    it('shows the label and the value', () => {
      expect(text()).toContain('Total applications');
      expect(text()).toContain('128');
    });

    it('explains the absence instead of showing a bare dash when there is no comparison', () => {
      expect(text()).toContain('No figures for the previous period');
    });

    it('shows the change and its caption when there is one', () => {
      set({ change: 12.5, direction: 'UP' });

      expect(text()).toContain('12,5%');
      expect(text()).toContain('vs last period');
    });

    it('draws no arrow when the metric is flat', () => {
      set({ change: 0, direction: 'FLAT' });

      const arrows = (fixture.nativeElement as HTMLElement).querySelectorAll('svg');
      expect(arrows).toHaveLength(0);
    });

    it('draws an arrow once the metric has moved', () => {
      set({ change: 5, direction: 'UP' });

      const arrows = (fixture.nativeElement as HTMLElement).querySelectorAll('svg');
      expect(arrows.length).toBeGreaterThan(0);
    });

    it('draws the icon tile only when icon paths are given', () => {
      expect((fixture.nativeElement as HTMLElement).querySelectorAll('svg path')).toHaveLength(0);

      set({ iconPaths: [...METRIC_ICONS.document] });

      expect(
        (fixture.nativeElement as HTMLElement).querySelectorAll('svg path').length,
      ).toBeGreaterThan(0);
    });

    it('puts the full value in a title, so a truncated figure is still readable', () => {
      set({ value: '1.234.567.890' });

      const valueEl = (fixture.nativeElement as HTMLElement).querySelector('[title]');
      expect(valueEl?.getAttribute('title')).toBe('1.234.567.890');
    });

    it('hides the decorative icon from screen readers', () => {
      set({ iconPaths: [...METRIC_ICONS.wallet] });

      const tile = (fixture.nativeElement as HTMLElement).querySelector('[aria-hidden="true"]');
      expect(tile).not.toBeNull();
    });
  });
});

describe('METRIC_ICONS', () => {
  it('gives every icon at least one path', () => {
    for (const [name, paths] of Object.entries(METRIC_ICONS)) {
      expect(paths.length, name).toBeGreaterThan(0);
    }
  });

  it('holds only non-empty path strings', () => {
    for (const paths of Object.values(METRIC_ICONS)) {
      for (const d of paths) {
        expect(typeof d).toBe('string');
        expect(d.trim()).not.toBe('');
      }
    }
  });

  it('covers the five dashboard metrics plus users', () => {
    expect(Object.keys(METRIC_ICONS).sort()).toEqual(
      ['check', 'clock', 'cross', 'document', 'users', 'wallet'].sort(),
    );
  });
});
