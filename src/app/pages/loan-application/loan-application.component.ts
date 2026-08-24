import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import {
  LoanApplication,
  LoanStatus,
  STATUS_GROUPS,
  SortDirection,
  SortableField,
  StatusGroup,
  statusesMatching,
} from '../../models/loan-application/loan-application.models';
import {
  ApplicationReviewModalComponent,
  ReviewDecision,
} from './application-review-modal.component';
import { LoanApplicationService } from '../../core/services/loan-application/loan-application.service';
import { LayoutSearchService } from '../../layout/layout-search.service';

interface StatusStyle {
  label: string;
  classes: string;
}

const STATUS_STYLES: Record<LoanStatus, StatusStyle> = {
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

@Component({
  selector: 'app-loan-application',
  standalone: true,
  imports: [DatePipe, FormsModule, ApplicationReviewModalComponent],
  templateUrl: './loan-application.component.html',
})
export class LoanApplicationComponent implements OnInit {
  private readonly service = inject(LoanApplicationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly search = inject(LayoutSearchService);

  readonly pageSizes = PAGE_SIZES;

  /**
   * Tabs come from STATUS_GROUPS. Each one carries a regex over the status
   * NAME, expanded to a concrete status list at request time — so a tab can
   * cover several statuses without listing them by hand.
   */
  readonly tabs: StatusGroup[] = STATUS_GROUPS;

  /* state */

  readonly rows = signal<LoanApplication[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly activeTab = signal<StatusGroup>(this.tabs[1]);

  readonly page = signal(0);
  readonly size = signal(10);
  readonly sortBy = signal<SortableField>('submissionDate');
  readonly sortDir = signal<SortDirection>('desc');

  readonly totalElements = signal(0);
  readonly totalPages = signal(0);
  readonly first = signal(true);
  readonly last = signal(true);

  readonly selected = signal<LoanApplication | null>(null);
  readonly submitting = signal(false);
  readonly toast = signal<string | null>(null);

  /* derived */

  /** Statuses the active tab resolves to. Empty = no filter. */
  readonly activeStatuses = computed<LoanStatus[]>(() =>
    statusesMatching(this.activeTab().pattern),
  );

  /** Client-side narrowing of the rows already loaded — not a server search. */
  readonly visibleRows = computed(() => {
    const q = this.search.query().trim().toLowerCase();
    if (!q) return this.rows();

    return this.rows().filter(
      (r) =>
        r.applicationId.toLowerCase().includes(q) ||
        (r.customer?.customerName ?? '').toLowerCase().includes(q) ||
        (r.purpose ?? '').toLowerCase().includes(q),
    );
  });

  readonly rangeStart = computed(() =>
    this.totalElements() === 0 ? 0 : this.page() * this.size() + 1,
  );

  readonly rangeEnd = computed(() =>
    Math.min(this.page() * this.size() + this.rows().length, this.totalElements()),
  );

  /** Windowed page numbers with gaps, e.g. [1, 2, 3, '…', 25]. */
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

  /* lifecycle */

  ngOnInit(): void {
    this.search.configure('Filter this page…');
    this.load();
  }

  /* data */

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.service
      .list({
        page: this.page(),
        size: this.size(),
        sortBy: this.sortBy(),
        sortDir: this.sortDir(),
        statuses: this.activeStatuses(),
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
          this.error.set(
            err?.error?.message ?? 'Could not load applications. Check your connection and retry.',
          );
          this.loading.set(false);
        },
      });
  }

  /* table interaction */

  selectTab(tab: StatusGroup): void {
    if (tab.key === this.activeTab().key) return;
    this.activeTab.set(tab);
    this.page.set(0);
    this.load();
  }

  toggleSort(field: SortableField): void {
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

  /* modal */

  view(application: LoanApplication): void {
    this.selected.set(application);
  }

  closeModal(): void {
    this.selected.set(null);
    this.submitting.set(false);
  }

  onDecided(decision: ReviewDecision): void {
    this.submitting.set(true);

    this.service
      .submitReview({
        applicationId: decision.applicationId,
        approve: decision.approve,
        note: decision.note || undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.selected.set(null);
          this.showToast(
            decision.approve
              ? `${decision.applicationId} sent to the branch manager.`
              : `${decision.applicationId} rejected.`,
          );
          this.load();
        },
        error: (err) => {
          this.submitting.set(false);
          this.showToast(err?.error?.message ?? 'The decision could not be saved. Try again.');
        },
      });
  }

  onRevisionRequested(decision: ReviewDecision): void {
    // No backend endpoint for this yet — see the notes in chat.
    this.showToast(`Revision requests are not wired up yet (${decision.applicationId}).`);
  }

  private showToast(message: string): void {
    this.toast.set(message);
    setTimeout(() => this.toast.set(null), 4000);
  }

  /* presentation helpers */

  statusStyle(status: LoanStatus): StatusStyle {
    return (
      STATUS_STYLES[status] ?? {
        label: status,
        classes: 'bg-slate-100 text-slate-700 ring-slate-200',
      }
    );
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

  /** Deterministic avatar tint so the same customer keeps the same colour. */
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

  trackById = (_: number, row: LoanApplication) => row.applicationId;
}
