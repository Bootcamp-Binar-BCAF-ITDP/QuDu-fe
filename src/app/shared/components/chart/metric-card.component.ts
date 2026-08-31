import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type TrendDirection = 'UP' | 'DOWN' | 'FLAT';

@Component({
  selector: 'app-metric-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="rounded-xl border border-slate-200 bg-white p-5">
      <div class="flex items-start gap-4">
        @if (iconPaths().length) {
          <div
            class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
            [class]="tileClasses()"
            aria-hidden="true"
          >
            <svg
              class="h-6 w-6"
              [class]="iconClasses()"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              viewBox="0 0 24 24"
            >
              @for (path of iconPaths(); track path) {
                <path stroke-linecap="round" stroke-linejoin="round" [attr.d]="path" />
              }
            </svg>
          </div>
        }

        <div class="min-w-0">
          <p class="text-xs text-slate-500">{{ label() }}</p>
          <p class="mt-1 truncate text-2xl font-semibold text-slate-900" [title]="value()">
            {{ value() }}
          </p>
        </div>
      </div>

      <div class="mt-4 flex flex-wrap items-baseline gap-x-1.5 text-xs">
        @if (changeLabel(); as label) {
          <span class="inline-flex items-center gap-0.5 font-medium" [class]="trendClasses()">
            @if (direction() !== 'FLAT') {
              <svg
                class="h-3 w-3"
                [class.rotate-180]="direction() === 'DOWN'"
                fill="none"
                stroke="currentColor"
                stroke-width="2.2"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M12 19V5m0 0l-6 6m6-6l6 6"
                />
              </svg>
            }
            {{ label }}
          </span>

          @if (caption()) {
            <span class="text-slate-400">{{ caption() }}</span>
          }
        } @else {
          <span class="text-slate-400">{{ emptyCaption() }}</span>
        }
      </div>
    </article>
  `,
})
export class MetricCardComponent {
  readonly label = input.required<string>();
  /** Pre-formatted — the card does not know whether this is money or a count. */
  readonly value = input.required<string>();

  /** Percentage change. Null hides the trend row and shows `emptyCaption` instead. */
  readonly change = input<number | null>(null);
  readonly direction = input<TrendDirection>('FLAT');
  readonly caption = input<string | null>('vs last period');
  readonly emptyCaption = input('No figures for the previous period');

  /**
   * For metrics where rising is bad (rejections, defaults, complaints): swaps
   * the red and green so the colour still means "good" or "bad".
   */
  readonly invertTrend = input(false);

  readonly iconPaths = input<string[]>([]);
  readonly tileClasses = input('bg-slate-100');
  readonly iconClasses = input('text-slate-600');

  readonly changeLabel = computed(() => {
    const change = this.change();
    return change == null ? null : `${Math.abs(change).toFixed(1).replace('.', ',')}%`;
  });

  readonly trendClasses = computed(() => {
    const direction = this.direction();
    if (direction === 'FLAT') return 'text-slate-400';

    const good = this.invertTrend() ? direction === 'DOWN' : direction === 'UP';
    return good ? 'text-green-600' : 'text-red-600';
  });
}

/** Shared icon paths, so pages do not each hand-roll their own. */
export const METRIC_ICONS = {
  document: ['M8 3h6l4 4v14a1 1 0 01-1 1H8a1 1 0 01-1-1V4a1 1 0 011-1z', 'M14 3v5h5'],
  clock: ['M12 21a9 9 0 100-18 9 9 0 000 18z', 'M12 7.5V12l3 2'],
  check: ['M12 21a9 9 0 100-18 9 9 0 000 18z', 'M8.5 12.3l2.4 2.4 4.6-5'],
  cross: ['M12 21a9 9 0 100-18 9 9 0 000 18z', 'M9.5 9.5l5 5m0-5l-5 5'],
  wallet: [
    'M4 8a2 2 0 012-2h11a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2V8z',
    'M4 8V7a2 2 0 012-2h9',
    'M16 12.5h2.5',
  ],
  users: [
    'M15 19v-1.5a3.5 3.5 0 00-3.5-3.5h-4A3.5 3.5 0 004 17.5V19',
    'M9.5 10.5a3 3 0 100-6 3 3 0 000 6z',
    'M20 19v-1.5a3.5 3.5 0 00-2.6-3.4',
  ],
} as const;
