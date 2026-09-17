import { DatePipe, Location } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { distinctUntilChanged, map } from 'rxjs';
import { AuthService } from '../../core/services/auth.services';
import { PlafondRequestService } from '../../core/services/plafond-request/plafond-request.services';
import { DocumentPreviewService } from '../../core/services/document/document-preview.service';
import { DocumentPreviewModalComponent } from '../../shared/components/document-preview-modal/document-preview-modal.component';
import { PlafondRequestDocument } from '../../models/plafond-request/plafond-request.models';
import {
  PlafondDecision,
  PlafondRequestItem,
  PlafondRequestStatus,
} from '../../models/plafond-request/plafond-request.models';
import { apiErrorMessage, humaniseApiMessage } from '../../shared/utils/api-message.util';

export type RoleName = 'MARKETING' | 'BRANCH_MANAGER' | 'BACK_OFFICE' | 'ADMIN';

const DECIDING_ROLE: RoleName = 'BRANCH_MANAGER';

interface Chip {
  label: string;
  classes: string;
}

const STATUS_STYLES: Record<PlafondRequestStatus, Chip> = {
  PENDING: { label: 'Awaiting decision', classes: 'bg-amber-50 text-amber-700 ring-amber-200' },
  APPROVED: { label: 'Approved', classes: 'bg-green-50 text-green-700 ring-green-200' },
  REJECTED: { label: 'Rejected', classes: 'bg-red-50 text-red-700 ring-red-200' },
};

const NEUTRAL_CHIP: Chip = {
  label: 'Unknown',
  classes: 'bg-slate-100 text-slate-700 ring-slate-200',
};

export type StageState = 'done' | 'current' | 'failed' | 'upcoming';

export interface Stage {
  key: string;
  title: string;
  actor: string | null;
  date: string | null;
  state: StageState;
}

@Component({
  selector: 'app-plafond-application-review',
  standalone: true,
  imports: [DatePipe, FormsModule, DocumentPreviewModalComponent],
  templateUrl: './plafond-application-review.component.html',
})
export class PlafondApplicationReviewComponent {
  private readonly service = inject(PlafondRequestService);
  private readonly preview = inject(DocumentPreviewService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);

  readonly requestId = signal('');
  readonly request = signal<PlafondRequestItem | null>(null);

  readonly documents = computed<PlafondRequestDocument[]>(() => this.request()?.documents ?? []);

  readonly previewDocument = signal<PlafondRequestDocument | null>(null);

  readonly previewUrl = computed<string | null>(() => {
    const doc = this.previewDocument();
    if (doc?.documentId == null) return null;
    return this.preview.plafondDocumentUrl(this.requestId(), doc.documentId);
  });

  openPreview(doc: PlafondRequestDocument): void {
    this.previewDocument.set(doc);
  }

  closePreview(): void {
    this.previewDocument.set(null);
  }

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly role = computed<RoleName | null>(() => this.auth.user()?.role ?? null);

  readonly notes = signal('');

  readonly approvedAmount = signal<number | null>(null);

  readonly busy = signal(false);
  readonly actionError = signal<string | null>(null);
  readonly done = signal<string | null>(null);

  constructor() {
    this.route.paramMap
      .pipe(
        map((params) => params.get('requestId') ?? ''),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((id) => {
        this.requestId.set(id);
        this.done.set(null);
        this.actionError.set(null);
        this.resetForm();
        this.load();
      });
  }

  load(): void {
    const id = this.requestId();
    if (!id) {
      this.error.set('No request id in the URL.');
      this.loading.set(false);
      return;
    }

    const passed = (this.router.getCurrentNavigation()?.extras.state ??
      (history.state as { request?: PlafondRequestItem })) as
      { request?: PlafondRequestItem } | undefined;

    const preloaded = passed?.request;
    if (preloaded?.requestId === id) {
      this.request.set(preloaded);
      this.error.set(null);
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.service
      .findOne(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (found) => {
          this.request.set(found);
          if (!found) {
            this.error.set(
              `Request ${id} is not in the queue. It may already have been decided by someone else.`,
            );
          }
          this.loading.set(false);
        },
        error: (err) => {
          this.request.set(null);
          this.error.set(apiErrorMessage(err, 'Could not load this request. Retry in a moment.'));
          this.loading.set(false);
        },
      });
  }

  back(): void {
    this.location.back();
  }

  backToQueue(): void {
    this.router.navigate(['/plafond-applications']);
  }


  readonly canDecide = computed(() => {
    const role = this.role();
    return role == null || role === DECIDING_ROLE;
  });

  readonly mode = computed<'DECIDE' | null>(() => {
    const request = this.request();
    if (!request || this.done()) return null;
    if (request.status !== 'PENDING') return null;
    if (!this.canDecide()) return null;
    return 'DECIDE';
  });

  readonly idleMessage = computed<string | null>(() => {
    const request = this.request();
    if (!request || this.done() || this.mode()) return null;

    if (request.status === 'APPROVED') {
      return 'Closed. This upgrade was approved and the customer limit has been raised.';
    }
    if (request.status === 'REJECTED') {
      return 'Closed. This upgrade was rejected.';
    }
    return 'Only a branch manager can decide on a plafond upgrade.';
  });


  readonly effectiveAmount = computed<number>(() => {
    const typed = this.approvedAmount();
    const requested = this.request()?.requestedAmount ?? 0;
    return typed == null || typed <= 0 ? requested : typed;
  });

  readonly amountTooHigh = computed(() => {
    const typed = this.approvedAmount();
    const requested = this.request()?.requestedAmount;
    if (typed == null || requested == null) return false;
    return typed > requested;
  });

  readonly amountReduced = computed(() => {
    const typed = this.approvedAmount();
    const requested = this.request()?.requestedAmount;
    if (typed == null || requested == null) return false;
    return typed > 0 && typed < requested;
  });

  approve(): void {
    const request = this.request();
    if (!request) return;

    const typed = this.approvedAmount();

    if (typed != null && typed <= 0) {
      this.actionError.set('The approved amount has to be greater than zero.');
      return;
    }
    if (this.amountTooHigh()) {
      this.actionError.set(
        `The approved amount cannot be higher than the requested ${this.formatRupiah(
          request.requestedAmount,
        )}.`,
      );
      return;
    }

    this.run(
      'APPROVED',
      typed ?? undefined,
      this.amountReduced()
        ? 'Approved at a reduced amount. The customer limit and tier have been updated.'
        : 'Approved. The customer limit and tier have been updated.',
    );
  }

  reject(): void {
    const trimmed = this.notes().trim();
    if (!trimmed) {
      this.actionError.set('Add a note explaining the rejection before you send it.');
      return;
    }

    this.run('REJECTED', undefined, 'Rejected. The customer keeps their current plafond.');
  }

  private run(
    decision: PlafondDecision,
    approvedAmount: number | undefined,
    message: string,
  ): void {
    const request = this.request();
    if (!request || this.busy()) return;

    this.busy.set(true);
    this.actionError.set(null);

    this.service
      .decide(request.requestId, {
        decision,
        approvedAmount,
        notes: this.notes().trim() || undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.busy.set(false);
          this.done.set(message);
          this.resetForm();
          this.request.set(updated);
        },
        error: (err) => {
          this.busy.set(false);
          this.actionError.set(this.errorMessage(err));
        },
      });
  }

  private resetForm(): void {
    this.notes.set('');
    this.approvedAmount.set(null);
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
        return 'The server rejected the request. Check the amount and try again.';
      case 401:
        return 'Your session expired. Sign in again and resend it.';
      case 403:
        return 'Your role cannot decide on plafond upgrades.';
      case 404:
        return 'This request no longer exists.';
      case 409:
        return 'This request already moved on. Reload to see where it stands.';
      default:
        return 'That did not save. Try again.';
    }
  }


  readonly chip = computed<Chip>(() => {
    const request = this.request();
    if (!request) return NEUTRAL_CHIP;
    return (
      STATUS_STYLES[request.status] ?? { label: request.status, classes: NEUTRAL_CHIP.classes }
    );
  });

  readonly tier = computed(() => this.request()?.requestedPlafond ?? null);

  readonly levelJump = computed<number | null>(() => {
    const request = this.request();
    if (!request || request.previousLevel == null) return null;
    return request.requestedLevel - request.previousLevel;
  });

  readonly stages = computed<Stage[]>(() => {
    const request = this.request();
    if (!request) return [];

    const decided = request.status !== 'PENDING';

    const raw = [
      {
        key: 'requested',
        title: `Upgrade requested — level ${request.requestedLevel}`,
        actor: request.customerName ?? null,
        date: request.requestDate ?? null,
      },
      {
        key: 'decision',
        title: 'Branch manager decision',
        actor: request.reviewedBy ?? null,
        date: request.decisionDate ?? null,
      },
      {
        key: 'applied',
        title: 'New limit applied',
        actor: null,
        date: request.status === 'APPROVED' ? request.decisionDate : null,
      },
    ];

    return raw.map((stage, index) => {
      let state: StageState;

      if (index === 0) {
        state = 'done';
      } else if (index === 1) {
        if (!decided) state = 'current';
        else state = request.status === 'REJECTED' ? 'failed' : 'done';
      } else {
        if (request.status === 'APPROVED') state = 'done';
        else if (request.status === 'REJECTED') state = 'upcoming';
        else state = 'upcoming';
      }

      return { ...stage, state };
    });
  });

  formatRupiah(value: number | null | undefined): string {
    if (value == null) return '—';
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(value);
  }

  formatRate(value: number | null | undefined): string {
    if (value == null) return '—';
    return `${(value * 100).toFixed(2).replace(/\.?0+$/, '')}%`;
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
