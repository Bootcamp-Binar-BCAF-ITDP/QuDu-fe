import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.services';
import { PlafondRequestService } from '../../core/services/plafond-request/plafond-request.services';
import {
  PlafondRequestItem,
  PlafondRequestStatus,
} from '../../models/plafond-request/plafond-request.models';
import { SortDirection } from '../../models/loan-application/loan-application.models';

interface Chip {
  label: string;
  classes: string;
}

const STATUS_STYLES: Record<PlafondRequestStatus, Chip> = {
  PENDING: { label: 'Awaiting decision', classes: 'bg-amber-50 text-amber-700 ring-amber-200' },
  APPROVED: { label: 'Approved', classes: 'bg-green-50 text-green-700 ring-green-200' },
  REJECTED: { label: 'Rejected', classes: 'bg-red-50 text-red-700 ring-red-200' },
};

const PAGE_SIZES = [5, 10, 25, 50];

/**
 * Sort keys are Pageable property paths on CustomerPlafondRequest, so nested
 * ones have to be spelled the way the entity spells them.
 */
export type PlafondSortField =
  | 'requestId'
  | 'customer.customerName'
  | 'requestedAmount'
  | 'requestedPlafond.level'
  | 'requestDate';

@Component({
  selector: 'app-plafond-application',
  standalone: true,
  imports: [DatePipe, FormsModule],
  templateUrl: './plafond-application.component.html',
})
export class PlafondApplicationComponent implements OnInit {
  private readonly service = inject(PlafondRequestService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  readonly pageSizes = PAGE_SIZES;

  readonly role = computed(() => this.auth.user()?.role ?? null);

  readonly rows = signal<PlafondRequestItem[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly page = signal(0);
  readonly size = signal(PAGE_SIZES[1]);
  readonly sortBy = signal<PlafondSortField>('requestDate');
  readonly sortDir = signal<SortDirection>('asc');

  readonly totalElements = signal(0);
  readonly totalPages = signal(0);
  readonly first = signal(true);
  readonly last = signal(true);

  readonly rangeStart = computed(() =>
    this.totalElements() === 0 ? 0 : this.page() * this.size() + 1,
  );

  readonly rangeEnd = computed(() =>
    Math.min(this.page() * this.size() + this.rows().length, this.totalElements()),
  );

  readonly pageNumbers = computed<(number | '…')[]>(() => {
    const total = this.totalPages();
    const current = this.page() + 1;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

    const out: (number | '…')[] = [1];
    const from = Math.max(2, current - 1);
    const to = Math.min(total - 1, current + 1);

    if (from > 2) out.push('…');
    for (let i = from; i <= to; i++) out.push(i);
    if (to < total - 1) out.push('…');
    out.push(total);

    return out;
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.service
      .bucket({
        page: this.page(),
        size: this.size(),
        sortBy: this.sortBy(),
        sortDir: this.sortDir(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.rows.set(res.content ?? []);
          this.totalElements.set(res.totalElements);
          this.totalPages.set(res.totalPages);
          this.first.set(res.first);
          this.last.set(res.last);
          this.loading.set(false);
        },
        error: (err) => {
          this.rows.set([]);
          this.totalElements.set(0);
          this.totalPages.set(0);
          this.error.set(
            err?.error?.message ?? 'Could not load this queue. Check your connection and retry.',
          );
          this.loading.set(false);
        },
      });
  }

  // ---- sorting, paging ----

  toggleSort(field: PlafondSortField): void {
    if (this.sortBy() === field) {
      this.sortDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortBy.set(field);
      this.sortDir.set('asc');
    }
    this.page.set(0);
    this.load();
  }

  changeSize(next: number): void {
    this.size.set(Number(next));
    this.page.set(0);
    this.load();
  }

  goToPage(target: number | '…'): void {
    if (target === '…') return;
    const zeroBased = target - 1;
    if (zeroBased === this.page() || zeroBased < 0 || zeroBased >= this.totalPages()) return;
    this.page.set(zeroBased);
    this.load();
  }

  previousPage(): void {
    if (!this.first()) {
      this.page.update((p) => p - 1);
      this.load();
    }
  }

  nextPage(): void {
    if (!this.last()) {
      this.page.update((p) => p + 1);
      this.load();
    }
  }

  // ---- navigation ----

  /**
   * The row travels in navigation state so the review page does not have to
   * walk the bucket again; it falls back to a lookup on a hard refresh.
   */
  open(item: PlafondRequestItem): void {
    this.router.navigate(['/plafond-applications', item.requestId], { state: { request: item } });
  }

  // ---- presentation helpers ----

  statusStyle(status: PlafondRequestStatus): Chip {
    return (
      STATUS_STYLES[status] ?? {
        label: status,
        classes: 'bg-slate-100 text-slate-700 ring-slate-200',
      }
    );
  }

  /** A jump of more than one tier is worth a second look, so it is called out. */
  levelJump(item: PlafondRequestItem): number | null {
    if (item.previousLevel == null) return null;
    return item.requestedLevel - item.previousLevel;
  }

  formatRupiah(value: number | null | undefined): string {
    if (value == null) return '—';
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(value);
  }

  initials(name: string | null | undefined): string {
    if (!name) return '?';
    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  avatarTint(seed: string): string {
    const tints = [
      'bg-green-600',
      'bg-slate-500',
      'bg-blue-600',
      'bg-amber-600',
      'bg-indigo-600',
      'bg-teal-600',
    ];
    let hash = 0;
    for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    return tints[hash % tints.length];
  }
}
