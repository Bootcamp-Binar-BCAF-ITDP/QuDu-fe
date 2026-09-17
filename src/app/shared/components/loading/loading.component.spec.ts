import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoadingComponent } from './loading.component';

describe('LoadingComponent', () => {
  let fixture: ComponentFixture<LoadingComponent>;
  let loading: LoadingComponent;

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [LoadingComponent] }).compileComponents();

    fixture = TestBed.createComponent(LoadingComponent);
    loading = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('defaults to a medium inline spinner with Indonesian wording', () => {
    expect(loading.text()).toBe('Memuat data...');
    expect(loading.size()).toBe('md');
    expect(loading.fullScreen()).toBe(false);
  });

  it('shows its default message', () => {
    expect(text()).toContain('Memuat data...');
  });

  it('takes a caller message', () => {
    fixture.componentRef.setInput('text', 'Menyiapkan laporan...');
    fixture.detectChanges();

    expect(text()).toContain('Menyiapkan laporan...');
  });

  it('can be told to show no message at all', () => {
    fixture.componentRef.setInput('text', null);
    fixture.detectChanges();

    expect(text()).not.toContain('Memuat');
  });

  it('accepts each declared size', () => {
    for (const size of ['sm', 'md', 'lg'] as const) {
      fixture.componentRef.setInput('size', size);
      fixture.detectChanges();

      expect(loading.size()).toBe(size);
    }
  });

  it('can cover the screen for a first load', () => {
    fixture.componentRef.setInput('fullScreen', true);
    fixture.detectChanges();

    expect(loading.fullScreen()).toBe(true);
  });

  it('renders something visible in every configuration', () => {
    for (const fullScreen of [false, true]) {
      fixture.componentRef.setInput('fullScreen', fullScreen);
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).children.length).toBeGreaterThan(0);
    }
  });
});
