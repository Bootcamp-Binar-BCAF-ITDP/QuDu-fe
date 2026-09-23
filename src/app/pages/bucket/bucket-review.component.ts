import { DatePipe, Location } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Observable, distinctUntilChanged, map, switchMap } from 'rxjs';
import {
  CreditScore,
  LoanApplication,
  LoanDocumentResponse,
  LoanStatus,
} from '../../models/loan-application/loan-application.models';
import { LoanApplicationService } from '../../core/services/loan-application/loan-application.service';
import { DocumentPreviewService } from '../../core/services/document/document-preview.service';
import { DocumentPreviewModalComponent } from '../../shared/components/document-preview-modal/document-preview-modal.component';
import { DocumentThumbnailComponent } from '../../shared/components/document-thumbnail/document-thumbnail.component';
import { apiErrorMessage, humaniseApiMessage } from '../../shared/utils/api-message.util';

export type RoleName = 'MARKETING' | 'BRANCH_MANAGER' | 'BACK_OFFICE' | 'ADMIN';

export type ActionMode =
  'MARKETING_REVIEW' | 'BM_DECISION' | 'BACK_OFFICE_CALL' | 'BACK_OFFICE_DISBURSE';

const MODE_BY_STATUS: Partial<Record<LoanStatus, ActionMode>> = {
  CHECKING: 'MARKETING_REVIEW',
  PENDING_BRANCH_MANAGER: 'BM_DECISION',
  PENDING_BACK_OFFICE: 'BACK_OFFICE_CALL',
  VERIFIED: 'BACK_OFFICE_DISBURSE',
};

const ALLOWED_BY_ROLE: Partial<Record<RoleName, ActionMode[]>> = {
  MARKETING: ['MARKETING_REVIEW'],
  BRANCH_MANAGER: ['BM_DECISION'],
  BACK_OFFICE: ['BACK_OFFICE_CALL', 'BACK_OFFICE_DISBURSE'],
};

const WAITING_ON: Record<LoanStatus, string> = {
  CHECKING: 'Waiting on marketing to review it.',
  REJECTED_BY_MARKETING: 'Closed. Marketing rejected it.',
  PENDING_BRANCH_MANAGER: 'Waiting on the branch manager to decide.',
  REJECTED_BY_BRANCH_MANAGER: 'Closed. The branch manager rejected it.',
  PENDING_BACK_OFFICE: 'Waiting on the back office to reach the customer.',
  VERIFIED: 'Verified. Waiting on the back office to disburse.',
  DISBURSED: 'Closed. The loan has been disbursed.',
  REJECTED_BY_BACK_OFFICE: 'Closed. The back office rejected it at disbursement.',
};

export const CALL_STATUSES = [
  'Can be Contacted',
  'Nada Sambung Tidak Diangkat',
  'Salah Sambung',
] as const;

export type CallStatus = (typeof CALL_STATUSES)[number];

interface Chip {
  label: string;
  classes: string;
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
  REJECTED_BY_BACK_OFFICE: {
    label: 'Rejected — back office',
    classes: 'bg-red-50 text-red-700 ring-red-200',
  },
};

const NEUTRAL_CHIP: Chip = {
  label: 'Unknown',
  classes: 'bg-slate-100 text-slate-700 ring-slate-200',
};



const DOCUMENT_ACRONYMS = new Set(['KTP', 'KK', 'NPWP', 'NIK', 'SIM', 'PBB']);

export type StageState = 'done' | 'current' | 'failed' | 'upcoming';

export interface Stage {
  key: string;
  title: string;
  actor: string | null;
  date: string | null;
  state: StageState;
}

const STAGE_AT: Record<LoanStatus, number> = {
  CHECKING: 1,
  REJECTED_BY_MARKETING: 1,
  PENDING_BRANCH_MANAGER: 2,
  REJECTED_BY_BRANCH_MANAGER: 2,
  PENDING_BACK_OFFICE: 3,
  VERIFIED: 4,
  DISBURSED: 5,
  REJECTED_BY_BACK_OFFICE: 5,
};

const REJECTED_STATUSES: readonly LoanStatus[] = [
  'REJECTED_BY_MARKETING',
  'REJECTED_BY_BRANCH_MANAGER',
  'REJECTED_BY_BACK_OFFICE',
];

interface RiskBand {
  label: string;
  chipClasses: string;
  barClasses: string;
  width: number;
}

@Component({
  selector: 'app-bucket-review',
  standalone: true,
  imports: [DatePipe, FormsModule, DocumentPreviewModalComponent, DocumentThumbnailComponent],
  templateUrl: './bucket-review.component.html',
})
export class BucketReviewComponent {
  private readonly service = inject(LoanApplicationService);
  private readonly preview = inject(DocumentPreviewService);
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly destroyRef = inject(DestroyRef);

  readonly applicationId = signal('');
  readonly application = signal<LoanApplication | null>(null);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly role = signal<RoleName | null>(null);

  readonly currentUserId = signal<string | null>(null);

  readonly callStatuses = CALL_STATUSES;
  readonly monthlyRateLabel = computed(() => {
    const annual = this.creditScore()?.annualInterestRate;
    if (annual == null) return '—';

    const monthly = (annual / 12) * 100;
    return `${monthly.toFixed(2).replace(/\.?0+$/, '')}%`;
  });

  readonly note = signal('');
  readonly callStatus = signal<CallStatus>('Can be Contacted');

  readonly busy = signal(false);
  readonly actionError = signal<string | null>(null);
  readonly done = signal<string | null>(null);

  constructor() {
    this.route.paramMap
      .pipe(
        map((params) => params.get('applicationId') ?? ''),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((id) => {
        this.applicationId.set(id);
        this.done.set(null);
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

    this.service
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
              : (apiErrorMessage(err, 'Could not load this application. Retry in a moment.')),
          );
          this.loading.set(false);
        },
      });
  }

  back(): void {
    this.location.back();
  }

  readonly mode = computed<ActionMode | null>(() => {
    const app = this.application();
    if (!app || this.done()) return null;

    const candidate = MODE_BY_STATUS[app.status] ?? null;
    if (!candidate) return null;

    const role = this.role();
    const allowed = role ? ALLOWED_BY_ROLE[role] : null;
    if (allowed && !allowed.includes(candidate)) return null;

    return candidate;
  });

  readonly missingReview = computed(
    () => this.mode() === 'BM_DECISION' && !this.application()?.review?.marketing,
  );

  readonly idleMessage = computed<string | null>(() => {
    const app = this.application();
    if (!app || this.done()) return null;
    if (this.mode() && !this.missingReview()) return null;

    if (this.missingReview()) {
      return 'Marketing has not submitted a review yet. This application needs one before you can decide.';
    }
    return WAITING_ON[app.status] ?? 'This application has no action pending.';
  });

  readonly payoutAccount = computed(() => {
    const app = this.application();
    if (!app) return null;

    return {
      bank: (app.bank ?? '').trim(),
      accountNumber: (app.bankAccountNumber ?? '').trim(),
      accountName: (app.bankAccountName ?? '').trim(),
    };
  });

  readonly disburseReady = computed(() => {
    const account = this.payoutAccount();
    return !!account && account.bank.length > 0 && account.accountNumber.length > 0;
  });

  submitReview(recommendation: 'ACCEPT' | 'REJECT'): void {
    const app = this.application();
    if (!app) return;

    const trimmed = this.note().trim();
    if (!trimmed) {
      this.actionError.set(
        recommendation === 'REJECT'
          ? 'Add a note explaining the rejection before you send it.'
          : 'Review note must be filled before you send it.',
      );
      return;
    }

    this.run(
      this.service.submitReview({
        applicationId: app.applicationId,
        recommendation,
        reviewNote: trimmed || undefined,
      }),
      recommendation === 'ACCEPT'
        ? 'Recommended. The application moved to the branch manager.'
        : 'Rejected. The applicant will be notified.',
    );
  }

  submitDecision(approve: boolean): void {
    const app = this.application();
    if (!app) return;

    const trimmed = this.note().trim();
    if (!approve && !trimmed) {
      this.actionError.set('Add a note explaining the rejection before you send it.');
      return;
    }

    this.run(
      this.service.decide({
        applicationId: app.applicationId,
        approve,
        note: trimmed || undefined,
      }),
      approve
        ? 'Approved. The application moved to the back office for verification calls.'
        : 'Rejected. The applicant will be notified.',
    );
  }

  logCall(): void {
    const app = this.application();
    if (!app) return;

    const status = this.callStatus();

    const trimmed = this.note().trim();
    if (!trimmed) {
      this.actionError.set('Call note must be filled before you log the call.');
      return;
    }

    this.run(
      this.service.logCall({
        applicationId: app.applicationId,
        callStatus: status,
        verificationNote: trimmed,
      }),
      status === 'Can be Contacted'
        ? 'Call logged. The application is verified and ready to disburse.'
        : 'Call logged. The application stays in your queue for another attempt.',
    );
  }

  disburse(): void {
    const app = this.application();
    if (!app) return;

    if (!this.disburseReady()) {
      this.actionError.set(
        'This application has no bank account on file, so it cannot be disbursed.',
      );
      return;
    }

    this.run(
      this.service.disburse({
        applicationId: app.applicationId,
        approve: true,
        note: this.note().trim() || undefined,
      }),
      'Disbursed. The application is complete and the customer has been notified by email.',
    );
  }

  rejectDisbursement(): void {
    const app = this.application();
    if (!app) return;

    const trimmed = this.note().trim();
    if (!trimmed) {
      this.actionError.set('Add a note explaining the rejection before you send it.');
      return;
    }

    this.run(
      this.service.disburse({
        applicationId: app.applicationId,
        approve: false,
        note: trimmed,
      }),
      'Rejected. The applicant will be notified.',
    );
  }

  private run(call: Observable<unknown>, successMessage: string): void {
    if (this.busy()) return;

    this.busy.set(true);
    this.actionError.set(null);

    call
      .pipe(
        switchMap(() => this.service.getOne(this.applicationId())),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (updated) => {
          this.busy.set(false);
          this.done.set(successMessage);
          this.resetForm();
          this.application.set(updated);
        },
        error: (err) => {
          this.busy.set(false);
          this.actionError.set(this.errorMessage(err));
        },
      });
  }

  private resetForm(): void {
    this.note.set('');
  }

  private errorMessage(err: unknown): string {
    const error = err as { status?: number; error?: { message?: string } };

    return humaniseApiMessage(error?.error?.message, this.statusFallback(error?.status));
  }

  private statusFallback(status: number | undefined): string {
    switch (status) {
      case 0:
        return 'No connection to the server. Check your network and try again.';
      case 400:
        return 'The server rejected the request. Check the form and try again.';
      case 401:
        return 'Your session expired. Sign in again and resend it.';
      case 403:
        return 'This application belongs to another branch, or your role cannot act on it.';
      case 404:
        return 'This application no longer exists.';
      case 409:
        return 'This application already moved on. Reload to see where it stands.';
      default:
        return 'That did not save. Try again.';
    }
  }

  readonly creditScore = computed<CreditScore | null>(
    () => this.application()?.creditScore ?? null,
  );

  readonly estimatedInstallment = computed<number | null>(
    () => this.creditScore()?.monthlyInstalment ?? null,
  );

  readonly debtToIncomePercent = computed<number | null>(() => {
    const dsr = this.creditScore()?.dsr;
    return dsr == null ? null : Math.round(dsr);
  });

  readonly dtiBarWidth = computed(() => {
    const pct = this.debtToIncomePercent();
    return pct == null ? 0 : Math.min(100, pct);
  });

  readonly dtiUnavailableReason = computed<string | null>(
    () => this.creditScore()?.unavailableReason ?? null,
  );

  readonly riskBand = computed<RiskBand>(() => {
    switch (this.creditScore()?.band) {
      case 'LOW':
        return {
          label: 'LOW',
          chipClasses: 'bg-green-600 text-white',
          barClasses: 'bg-green-600',
          width: 25,
        };
      case 'MODERATE':
        return {
          label: 'MODERATE',
          chipClasses: 'bg-amber-500 text-white',
          barClasses: 'bg-amber-500',
          width: 55,
        };
      case 'HIGH':
        return {
          label: 'HIGH',
          chipClasses: 'bg-orange-600 text-white',
          barClasses: 'bg-orange-600',
          width: 80,
        };
      case 'VERY_HIGH':
        return {
          label: 'VERY HIGH',
          chipClasses: 'bg-red-600 text-white',
          barClasses: 'bg-red-600',
          width: 100,
        };
      default:
        return {
          label: 'UNKNOWN',
          chipClasses: 'bg-slate-200 text-slate-600',
          barClasses: 'bg-slate-300',
          width: 0,
        };
    }
  });

  readonly chip = computed<Chip>(() => {
    const app = this.application();
    if (!app) return NEUTRAL_CHIP;
    return STATUS_STYLES[app.status] ?? { label: app.status, classes: NEUTRAL_CHIP.classes };
  });

  readonly documents = computed<LoanDocumentResponse[]>(() => this.application()?.documents ?? []);

  readonly previewDocument = signal<LoanDocumentResponse | null>(null);

  readonly previewUrl = computed<string | null>(() => {
    const doc = this.previewDocument();
    if (doc?.documentId == null) return null;
    return this.preview.loanDocumentUrl(this.applicationId(), doc.documentId);
  });

  readonly verifications = computed(() =>
    [...(this.application()?.verifications ?? [])].sort((a, b) =>
      (b.verificationDate ?? '').localeCompare(a.verificationDate ?? ''),
    ),
  );

  readonly decision = computed(() => this.application()?.bmdecision ?? null);

  readonly recommendation = computed(() => {
    const raw = (this.application()?.review?.recommendation ?? '').toUpperCase();

    if (!raw) {
      return { label: 'Not reviewed yet', classes: 'border-slate-200 bg-slate-50 text-slate-600' };
    }
    if (raw.includes('REJECT')) {
      return { label: 'Not recommended', classes: 'border-red-200 bg-red-50 text-red-800' };
    }
    return { label: 'Recommended', classes: 'border-green-200 bg-green-50 text-green-800' };
  });

  readonly stages = computed<Stage[]>(() => {
    const app = this.application();
    if (!app) return [];

    const at = STAGE_AT[app.status] ?? 0;
    const rejected = REJECTED_STATUSES.includes(app.status);
    const decision = this.decision();
    const calls = this.verifications();
    const latestCall = calls[0] ?? null;

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
        title: 'Branch manager decision',
        actor: decision?.branchManager?.fullName ?? null,
        date: decision?.decidedAt ?? null,
      },
      {
        key: 'verification',
        title:
          calls.length > 1 ? `Verification call (${calls.length} attempts)` : 'Verification call',
        actor: latestCall?.verifiedBy?.fullName ?? null,
        date: latestCall?.verificationDate ?? null,
      },
      {
        key: 'disbursement',
        title: 'Disbursement',
        actor: app.disbursement?.processedBy?.fullName ?? null,
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

  extension(doc: LoanDocumentResponse): string {
    const match = /\.([a-z0-9]+)$/i.exec(doc.fileName ?? '');
    return match ? match[1].toUpperCase() : 'FILE';
  }

  documentLabel(doc: LoanDocumentResponse): string {
    return (
      (doc.documentType ?? '')
        .split('_')
        .filter(Boolean)
        .map((part) => {
          const upper = part.toUpperCase();
          return DOCUMENT_ACRONYMS.has(upper)
            ? upper
            : upper.charAt(0) + part.slice(1).toLowerCase();
        })
        .join(' ') || 'Document'
    );
  }

  documentUrl(doc: LoanDocumentResponse): string | null {
    if (doc?.documentId == null) return null;
    return this.preview.loanDocumentUrl(this.applicationId(), doc.documentId);
  }

  openDocument(doc: LoanDocumentResponse): void {
    this.previewDocument.set(doc);
  }

  closePreview(): void {
    this.previewDocument.set(null);
  }

  callStatusClasses(callStatus: string | null | undefined): string {
    return (callStatus ?? '').toLowerCase().includes('can be contacted')
      ? 'bg-green-50 text-green-800 ring-green-200'
      : 'bg-amber-50 text-amber-800 ring-amber-200';
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
