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
import { LoanApplicationService } from '../../core/services/loan-application/loan-application.service';
import {
  CsvValue,
  csvDate,
  exportCsv as writeCsvFile,
  stampedFilename,
} from '../../shared/utils/csv-export.util';
import { ApplicationDetailModalComponent } from './application-review-modal.component';

/**
 * A ceiling on one export, not a page size. Large enough to cover a realistic
 * filtered report, small enough that a stray click cannot pull the whole table.
 */
const MAX_EXPORT_ROWS = 5000;

const EXPORT_HEADERS = [
  'Application ID',
  'Customer',
  'NIK',
  'Phone',
  'Requested amount',
  'Tenor (months)',
  'Purpose',
  'Monthly income',
  'Monthly instalment',
  'DSR (%)',
  'Risk band',
  'Status',
  'Submitted',
  'Bank',
  'Account number',
  'Account name',
];

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
  REJECTED_BY_BACK_OFFICE: {
    label: 'Rejected — back office',
    classes: 'bg-red-50 text-red-700 ring-red-200',
  },
};

const PAGE_SIZES = [5, 10, 25, 50];

@Component({
  selector: 'app-loan-application',
  standalone: true,
  imports: [DatePipe, FormsModule, ApplicationDetailModalComponent],
  templateUrl: './loan-application.component.html',
})
export class LoanApplicationComponent implements OnInit {
  private readonly service = inject(LoanApplicationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly pageSizes = PAGE_SIZES;
  readonly tabs: StatusGroup[] = STATUS_GROUPS;

  readonly rows = signal<LoanApplication[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly activeTab = signal<StatusGroup>(this.tabs[0]);

  readonly page = signal(0);
  readonly size = signal(10);
  readonly sortBy = signal<SortableField>('submissionDate');
  readonly sortDir = signal<SortDirection>('desc');

  readonly totalElements = signal(0);
  readonly totalPages = signal(0);
  readonly first = signal(true);
  readonly last = signal(true);

  readonly selected = signal<LoanApplication | null>(null);

  readonly exporting = signal(false);
  readonly exportError = signal<string | null>(null);
  readonly exportNote = signal<string | null>(null);

  /**
   * What the two date inputs hold. Empty means no bound on that side, which is
   * why they are plain strings rather than nullable dates: an <input type=date>
   * gives back '' when cleared, and turning that into null and back adds a
   * conversion with nothing to gain.
   */
  readonly fromDate = signal('');
  readonly toDate = signal('');

  readonly dateError = computed(() => {
    const from = this.fromDate();
    const to = this.toDate();
    return from && to && from > to ? 'The start date is after the end date.' : null;
  });

  readonly hasDateFilter = computed(() => !!this.fromDate() || !!this.toDate());

  /** What the user is typing. */
  readonly searchInput = signal('');

  /** What was actually sent to the server on the last load. */
  readonly appliedSearch = signal('');

  readonly searchDirty = computed(() => this.searchInput().trim() !== this.appliedSearch());

  readonly activeStatuses = computed<LoanStatus[]>(() =>
    statusesMatching(this.activeTab().pattern),
  );

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

  /**
   * Exports every application matching the current tab and search, not just the
   * page on screen. Exporting ten visible rows when the filter matches nine
   * hundred is the kind of export nobody wants twice.
   *
   * The cap exists so a careless click cannot ask the server for the entire
   * table. When it bites, the file is still produced and the UI says so rather
   * than quietly handing over a truncated report.
   */
  /** Any date change restarts at page one, or you land on a page that no longer exists. */
  applyDateFilter(): void {
    if (this.dateError()) return;
    this.page.set(0);
    this.load();
  }

  clearDateFilter(): void {
    if (!this.hasDateFilter()) return;
    this.fromDate.set('');
    this.toDate.set('');
    this.page.set(0);
    this.load();
  }

  exportCsv(): void {
    if (this.exporting() || this.dateError()) return;

    this.exporting.set(true);
    this.exportError.set(null);
    this.exportNote.set(null);

    this.service
      .list({
        page: 0,
        size: MAX_EXPORT_ROWS,
        sortBy: this.sortBy(),
        sortDir: this.sortDir(),
        statuses: this.activeStatuses(),
        search: this.appliedSearch() || undefined,
        from: this.fromDate() || undefined,
        to: this.toDate() || undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const rows = res.content ?? [];

          writeCsvFile(stampedFilename('applications'), [
            EXPORT_HEADERS,
            ...rows.map((app) => this.toExportRow(app)),
          ]);

          if (res.totalElements > rows.length) {
            this.exportNote.set(
              `Exported the first ${rows.length} of ${res.totalElements} matching applications.`,
            );
          }
          this.exporting.set(false);
        },
        error: (err) => {
          this.exportError.set(err?.error?.message ?? 'Could not build the export. Try again.');
          this.exporting.set(false);
        },
      });
  }

  private toExportRow(app: LoanApplication): CsvValue[] {
    return [
      app.applicationId,
      app.customer?.customerName ?? '',
      app.customer?.nik ?? '',
      app.customer?.phoneNumber ?? '',
      app.requestedAmount ?? '',
      app.tenor ?? '',
      app.purpose ?? '',
      app.income ?? '',
      app.creditScore?.monthlyInstalment ?? '',
      app.creditScore?.dsr ?? '',
      app.creditScore?.band ?? '',
      STATUS_STYLES[app.status]?.label ?? app.status,
      csvDate(app.submissionDate),
      app.bank ?? '',
      app.bankAccountNumber ?? '',
      app.bankAccountName ?? '',
    ];
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
        statuses: this.activeStatuses(),
        search: this.appliedSearch() || undefined,
        from: this.fromDate() || undefined,
        to: this.toDate() || undefined,
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

  // ---- filters, sorting, paging ----

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

  // ---- modal ----

  view(application: LoanApplication): void {
    this.selected.set(application);
  }

  closeModal(): void {
    this.selected.set(null);
  }

  // ---- presentation helpers ----

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
