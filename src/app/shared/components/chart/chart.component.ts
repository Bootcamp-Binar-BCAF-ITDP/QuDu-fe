import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  PLATFORM_ID,
  effect,
  inject,
  input,
  viewChild,
} from '@angular/core';
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  ChartData,
  ChartOptions,
  ChartType,
  DoughnutController,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PieController,
  PointElement,
  Tooltip,
} from 'chart.js';

Chart.register(
  LineController,
  BarController,
  DoughnutController,
  PieController,
  LineElement,
  PointElement,
  BarElement,
  ArcElement,
  CategoryScale,
  LinearScale,
  Filler,
  Legend,
  Tooltip,
);

@Component({
  selector: 'app-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host {
        display: block;
        position: relative;
      }

      canvas {
        display: block;
      }
    `,
  ],
  template: `<canvas #canvas role="img" [attr.aria-label]="ariaLabel()"></canvas>`,
})
export class ChartComponent {
  readonly type = input.required<ChartType>();
  readonly data = input.required<ChartData>();
  readonly options = input<ChartOptions>();
  readonly ariaLabel = input('Chart');

  private readonly canvas =
    viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private chart: Chart | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.teardown());

    effect(() => {
      const type = this.type();
      const data = this.data();
      const options = this.options() ?? {};

      if (!this.isBrowser) return;

      if (this.chart && (this.chart.config as { type: ChartType }).type !== type) {
        this.teardown();
      }

      if (this.chart) {
        this.chart.data = data;
        this.chart.options = options;
        this.chart.update();
        return;
      }

      this.chart = new Chart(this.canvas().nativeElement, { type, data, options });
    });
  }

  private teardown(): void {
    this.chart?.destroy();
    this.chart = null;
  }
}
