import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { BucketItem } from '../../models/bucket/bucket.models';
import { LoanStatus, SortDirection } from '../../models/loan-application/loan-application.models';
import { BucketService } from '../../core/services/bucket/bucket.services.';

interface Chip {
  label: string;
  classes: string;
}

interface Recommendation extends Chip {
  tone: 'positive' | 'negative' | 'neutral';
}

const STATUS_STYLES: Record<LoanStatus, Chip> = {
  CHECKING: { label: 'Checking', classes: 'bg-amber-50 text-amber-700 ring-amber-200' },
  REJECTED_BY_MARKETING: {
    label: 'Rejected — marketing',
    classes: 'bg-red-50 text-red-700 ring-red-200',
  },
  PENDING_BRANCH_MANAGER: {
    label: 'With branch manager',
    classes: 'bg-blue-50 text-blue-700 ring-blue-200',
  },
  REJECTED_BY_BRANCH_MANAGER: {
    label: 'Rejected — branch manager',
    classes: 'bg-red-50 text-red-700 ring-red-200',
  },
  PENDING_BACK_OFFICE: {
    label: 'With back office',
    classes: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  },
  VERIFIED: { label: 'Verified', classes: 'bg-green-50 text-green-700 ring-green-200' },
  DISBURSED: { label: 'Disbursed', classes: 'bg-green-100 text-green-800 ring-green-300' },
};

const PAGE_SIZES = [5, 10, 25, 50];

export type BucketSortField = 'applicationId' | 'requestedAmount' | 'submissionDate' | 'status';

@Component({
  selector: 'app-bucket',
  standalone: true,
  imports: [DatePipe, FormsModule],
  templateUrl: './bucket.component.html',
})
export class BucketComponent implements OnInit {
  private readonly service = inject(BucketService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  readonly pageSizes = PAGE_SIZES;

  readonly rows = signal<BucketItem[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly page = signal(0);
  readonly size = signal(PAGE_SIZES[0]);
  readonly sortBy = signal<BucketSortField>('submissionDate');
  readonly sortDir = signal<SortDirection>('desc');

  readonly totalElements = signal(0);
  readonly totalPages = signal(0);
  readonly first = signal(true);
  readonly last = signal(true);

  /** What the user is typing. */
  readonly searchInput = signal('');

  /** What was actually sent to the server on the last load. */
  readonly appliedSearch = signal('');

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
      .list({
        page: this.page(),
        size: this.size(),
        sortBy: this.sortBy(),
        sortDir: this.sortDir(),
        search: this.appliedSearch(),
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
            err?.error?.message ?? 'Could not load the bucket. Check your connection and retry.',
          );
          this.loading.set(false);
        },
      });
  }

  // ---- search ----

  submitSearch(): void {
    const term = this.searchInput().trim();
    if (term === this.appliedSearch()) return;

    this.appliedSearch.set(term);
    this.page.set(0);
    this.load();
  }

  clearSearch(): void {
    if (!this.searchInput() && !this.appliedSearch()) return;

    this.searchInput.set('');
    this.appliedSearch.set('');
    this.page.set(0);
    this.load();
  }

  // ---- sorting, paging ----

  toggleSort(field: BucketSortField): void {
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
  open(item: BucketItem): void {
    this.router.navigate(['/bucket', item.applicationId]);
  }

  // ---- presentation helpers ----
  statusStyle(status: LoanStatus): Chip {
    return (
      STATUS_STYLES[status] ?? {
        label: status,
        classes: 'bg-slate-100 text-slate-700 ring-slate-200',
      }
    );
  }

  recommendation(item: BucketItem): Recommendation {
    const raw = (item.review?.recommendation ?? '').toUpperCase();

    if (!raw) {
      return { label: 'Not reviewed', classes: 'text-slate-400', tone: 'neutral' };
    }
    if (raw.includes('REJECT')) {
      return { label: 'Not recommended', classes: 'text-red-600', tone: 'negative' };
    }
    return { label: 'Recommended', classes: 'text-green-700', tone: 'positive' };
  }

  creditScoreClass(score: number | null | undefined): string {
    if (score == null) return 'text-slate-300 ring-slate-200';
    if (score >= 750) return 'text-green-700 ring-green-500';
    if (score >= 650) return 'text-slate-600 ring-slate-300';
    return 'text-red-600 ring-red-400';
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
