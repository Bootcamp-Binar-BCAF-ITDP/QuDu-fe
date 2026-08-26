import { DatePipe, Location } from '@angular/common';
import { Component, DestroyRef, HostListener, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { distinctUntilChanged, map } from 'rxjs';
import {
  LoanApplication,
  LoanDocumentResponse,
  LoanStatus,
} from '../../models/loan-application/loan-application.models';
import { LoanApplicationService } from '../../core/services/loan-application/loan-application.service';
import { statusChip, StatusChip } from '../../shared/utils/loan-status.chip';
import { BranchManagerService, DecisionAction } from '../../core/services/bucket/branch-manager.services';

/** Indicative only — replace once the API returns the contracted rate. */
const MONTHLY_INTEREST_RATE = 0.01;

/** Above this, the debt-to-income ratio stops being comfortable. */
const HEALTHY_DTI = 0.35;

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'avif'];

const DOCUMENT_ACRONYMS = new Set(['KTP', 'KK', 'NPWP', 'NIK', 'SIM']);

/** `creditScore` is not in any response yet; the card degrades to 'Not scored'. */
export type ReviewApplication = LoanApplication & { creditScore?: number };

export type StageState = 'done' | 'current' | 'failed' | 'upcoming';

export interface Stage {
  key: string;
  title: string;
  actor: string | null;
  date: string | null;
  state: StageState;
}

interface RiskBand {
  label: string;
  chipClasses: string;
  barClasses: string;
  width: number;
}

const STAGE_AT: Record<LoanStatus, number> = {
  CHECKING: 1,
  REJECTED_BY_MARKETING: 1,
  PENDING_BRANCH_MANAGER: 2,
  REJECTED_BY_BRANCH_MANAGER: 2,
  PENDING_BACK_OFFICE: 3,
  VERIFIED: 3,
  DISBURSED: 5,
};

const NEUTRAL_CHIP: StatusChip = {
  label: 'Unknown',
  classes: 'bg-slate-100 text-slate-700 ring-slate-200',
};

const REJECTED_STATUSES: readonly LoanStatus[] = [
  'REJECTED_BY_MARKETING',
  'REJECTED_BY_BRANCH_MANAGER',
];

@Component({
  selector: 'app-bucket-review',
  standalone: true,
  imports: [DatePipe, FormsModule],
  templateUrl: './bucket-review.component.html',
})
export class BucketReviewComponent {
  private readonly applications = inject(LoanApplicationService);
  private readonly branchManager = inject(BranchManagerService);
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly destroyRef = inject(DestroyRef);

  readonly applicationId = signal('');
  readonly application = signal<ReviewApplication | null>(null);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly note = signal('');
  readonly saving = signal<DecisionAction | null>(null);
  readonly saveError = signal<string | null>(null);
  readonly saved = signal<DecisionAction | null>(null);

  readonly zoomed = signal<LoanDocumentResponse | null>(null);

  readonly healthyDtiLabel = `Healthy range < ${Math.round(HEALTHY_DTI * 100)}%`;
  readonly monthlyRateLabel = `${(MONTHLY_INTEREST_RATE * 100).toFixed(1).replace(/\.0$/, '')}%`;

  constructor() {
    this.route.paramMap
      .pipe(
        map((params) => params.get('applicationId') ?? ''),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((id) => {
        this.applicationId.set(id);
        this.load();
      });
  }

  load(): void {
    const id = this.applicationId();
    if (!id) {
      this.error.set('No application id in the URL.');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.applications
      .getOne(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (app) => {
          this.application.set(app);
          this.loading.set(false);
        },
        error: (err) => {
          this.application.set(null);
          this.error.set(
            err?.status === 404
              ? `Application ${id} was not found.`
              : (err?.error?.message ?? 'Could not load this application. Retry in a moment.'),
          );
          this.loading.set(false);
        },
      });
  }

  // ---- derived money ----

  readonly estimatedInstallment = computed<number | null>(() => {
    const app = this.application();
    if (!app?.requestedAmount || !app.tenor) return null;

    const r = MONTHLY_INTEREST_RATE;
    const factor = Math.pow(1 + r, app.tenor);
    return (app.requestedAmount * r * factor) / (factor - 1);
  });

  /** Installment against stated monthly income. Null when income is missing. */
  readonly debtToIncome = computed<number | null>(() => {
    const income = this.application()?.income;
    const installment = this.estimatedInstallment();
    if (!income || !installment) return null;
    return installment / income;
  });

  readonly debtToIncomePercent = computed<number | null>(() => {
    const dti = this.debtToIncome();
    return dti == null ? null : Math.round(dti * 100);
  });

  readonly dtiBarWidth = computed(() => {
    const pct = this.debtToIncomePercent();
    return pct == null ? 0 : Math.min(100, pct);
  });

  /**
   * Derived from DTI, not returned by the API. It is an affordability signal,
   * not a bureau grade — the template labels it as such.
   */
  readonly riskBand = computed<RiskBand>(() => {
    const dti = this.debtToIncome();

    if (dti == null) {
      return {
        label: 'UNKNOWN',
        chipClasses: 'bg-slate-200 text-slate-600',
        barClasses: 'bg-slate-300',
        width: 0,
      };
    }
    if (dti <= 0.25) {
      return {
        label: 'LOW',
        chipClasses: 'bg-green-600 text-white',
        barClasses: 'bg-green-600',
        width: 25,
      };
    }
    if (dti <= HEALTHY_DTI) {
      return {
        label: 'MEDIUM',
        chipClasses: 'bg-amber-500 text-white',
        barClasses: 'bg-amber-500',
        width: 60,
      };
    }
    return {
      label: 'HIGH',
      chipClasses: 'bg-red-600 text-white',
      barClasses: 'bg-red-600',
      width: 100,
    };
  });

  // ---- derived state ----

  readonly chip = computed<StatusChip>(() => {
    const app = this.application();
    return app ? statusChip(app.status) : NEUTRAL_CHIP;
  });

  readonly documents = computed<LoanDocumentResponse[]>(() => this.application()?.documents ?? []);

  readonly recommendation = computed(() => {
    const raw = (this.application()?.review?.recommendation ?? '').toUpperCase();

    if (!raw) {
      return {
        label: 'Not reviewed yet',
        classes: 'border-slate-200 bg-slate-50 text-slate-600',
        positive: false,
      };
    }
    if (raw.includes('REJECT')) {
      return {
        label: 'Not recommended',
        classes: 'border-red-200 bg-red-50 text-red-800',
        positive: false,
      };
    }
    return {
      label: 'Recommended',
      classes: 'border-green-200 bg-green-50 text-green-800',
      positive: true,
    };
  });

  /** The decision bar only appears when this application is actually ours to decide. */
  readonly canDecide = computed(
    () => this.application()?.status === 'PENDING_BRANCH_MANAGER' && !this.saved(),
  );

  readonly stages = computed<Stage[]>(() => {
    const app = this.application();
    if (!app) return [];

    const at = STAGE_AT[app.status] ?? 0;
    const rejected = REJECTED_STATUSES.includes(app.status);
    const verification = (app.verifications ?? []).at(-1) ?? null;

    const raw = [
      {
        key: 'submitted',
        title: 'Submitted',
        actor: app.customer?.customerName ?? null,
        date: app.submissionDate ?? null,
      },
      {
        key: 'marketing',
        title: 'Marketing review',
        actor: app.review?.marketing?.fullName ?? null,
        date: app.review?.uploadedAt ?? null,
      },
      {
        key: 'branch-manager',
        title: 'Branch manager review',
        actor: app.bmdecision?.branchManager?.fullName ?? null,
        date: app.bmdecision?.decidedAt ?? null,
      },
      {
        key: 'back-office',
        title: 'Back office disbursement',
        actor:
          verification?.verifiedBy?.fullName ?? app.disbursement?.processedBy?.fullName ?? null,
        date: verification?.verificationDate ?? app.disbursement?.disbursementDate ?? null,
      },
      {
        key: 'completed',
        title: 'Completed',
        actor: null,
        date: app.disbursement?.disbursementDate ?? null,
      },
    ];

    return raw.map((stage, index) => {
      let state: StageState;
      if (index < at) state = 'done';
      else if (index > at) state = 'upcoming';
      else state = rejected ? 'failed' : 'current';

      return { ...stage, state };
    });
  });

  // ---- decision ----

  submitDecision(outcome: DecisionAction): void {
    const app = this.application();
    if (!app || this.saving()) return;

    const trimmed = this.note().trim();
    if (outcome !== 'APPROVED' && !trimmed) {
      this.saveError.set('Add a note explaining the decision before rejecting or holding.');
      return;
    }

    this.saving.set(outcome);
    this.saveError.set(null);

    this.branchManager
      .decide({
        applicationId: app.applicationId,
        decision: outcome,
        decisionNote: trimmed || undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(null);
          this.saved.set(outcome);
          this.note.set('');
          // Refetch so the status pill, timeline and decision card all catch up.
          this.load();
        },
        error: (err) => {
          this.saving.set(null);
          this.saveError.set(
            err?.error?.message ?? 'The decision was not saved. Check your connection and retry.',
          );
        },
      });
  }

  readonly savedMessage = computed(() => {
    switch (this.saved()) {
      case 'APPROVED':
        return 'Approved. The application moved to the back office.';
      case 'REJECTED':
        return 'Rejected. The applicant will be notified.';
      case 'PENDING':
        return 'Held as pending. It stays in your queue.';
      default:
        return null;
    }
  });

  // ---- documents ----

  documentUrl(doc: LoanDocumentResponse): string {
    return this.applications.documentUrl(doc);
  }

  extension(doc: LoanDocumentResponse): string {
    const match = /\.([a-z0-9]+)$/i.exec(doc.fileName ?? '');
    return match ? match[1].toUpperCase() : 'FILE';
  }

  isImage(doc: LoanDocumentResponse): boolean {
    return IMAGE_EXTENSIONS.includes(this.extension(doc).toLowerCase());
  }

  documentLabel(doc: LoanDocumentResponse): string {
    return (
      (doc.documentType ?? '')
        .split('_')
        .filter(Boolean)
        .map((part) => {
          const upper = part.toUpperCase();
          return DOCUMENT_ACRONYMS.has(upper) ? upper : upper.charAt(0) + part.slice(1).toLowerCase();
        })
        .join(' ') || 'Document'
    );
  }

  openDocument(doc: LoanDocumentResponse): void {
    const url = this.documentUrl(doc);
    if (url) window.open(url, '_blank', 'noopener');
  }

  zoom(doc: LoanDocumentResponse): void {
    if (this.isImage(doc)) this.zoomed.set(doc);
  }

  @HostListener('document:keydown.escape')
  closeZoom(): void {
    this.zoomed.set(null);
  }

  // ---- formatting ----

  back(): void {
    this.location.back();
  }

  formatRupiah(value: number | null | undefined): string {
    if (value == null) return '—';
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(value);
  }

  formatMonths(months: number | null | undefined): string {
    if (months == null) return '—';
    const years = Math.floor(months / 12);
    const rest = months % 12;
    if (!years) return `${rest} months`;
    if (!rest) return `${years} ${years === 1 ? 'year' : 'years'}`;
    return `${years} ${years === 1 ? 'year' : 'years'}, ${rest} months`;
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
}
