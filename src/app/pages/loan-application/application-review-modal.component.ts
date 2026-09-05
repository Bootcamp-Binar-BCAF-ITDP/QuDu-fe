import { DatePipe } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  LoanApplication,
  LoanDocumentResponse,
} from '../../models/loan-application/loan-application.models';
import { LoanApplicationService } from '../../core/services/loan-application/loan-application.service';
import { DocumentPreviewModalComponent } from '../../shared/components/document-preview-modal/document-preview-modal.component';

const INDICATIVE_ANNUAL_RATE = 0.12;

/** `callStatus` is free text and often Indonesian, so match on both languages. */
const FAILED_CALL_MARKERS = [
  'FAIL',
  'GAGAL',
  'TIDAK',
  'BELUM',
  'NO ANSWER',
  'UNREACHABLE',
  'REJECT',
];

/** Document type tokens that should stay upper case in tab labels. */
const DOCUMENT_ACRONYMS = new Set(['KTP', 'KK', 'NPWP', 'NIK', 'SIM', 'PBB']);

export type TimelineTone = 'neutral' | 'positive' | 'negative';

export interface TimelineEntry {
  key: string;
  title: string;
  actor: string | null;
  note: string | null;
  date: string | Date | null;
  tone: TimelineTone;
}

@Component({
  selector: 'app-application-detail-modal',
  standalone: true,
  imports: [DatePipe, DocumentPreviewModalComponent],
  templateUrl: './application-review-modal.component.html',
})
export class ApplicationDetailModalComponent implements AfterViewInit, OnDestroy {
  private readonly service = inject(LoanApplicationService);

  readonly application = input.required<LoanApplication>();

  readonly closed = output<void>();

  readonly activeDocumentId = signal<number | null>(null);

  @ViewChild('closeButton') private closeButton?: ElementRef<HTMLButtonElement>;

  private readonly previouslyFocused = document.activeElement as HTMLElement | null;

  constructor() {
    document.body.classList.add('overflow-hidden');
  }

  ngAfterViewInit(): void {
    // `autofocus` does not fire on elements Angular inserts after page load.
    this.closeButton?.nativeElement.focus();
  }

  ngOnDestroy(): void {
    document.body.classList.remove('overflow-hidden');
    this.previouslyFocused?.focus();
  }

  // ---- derived data ----

  readonly documents = computed<LoanDocumentResponse[]>(() => this.application().documents ?? []);

  /** Falls back to the first document, so no effect is needed to preselect a tab. */
  readonly activeDocument = computed<LoanDocumentResponse | null>(() => {
    const docs = this.documents();
    if (!docs.length) return null;

    const id = this.activeDocumentId();
    return docs.find((d) => d.documentId === id) ?? docs[0];
  });

  readonly activeDocumentKey = computed<number | null>(
    () => this.activeDocument()?.documentId ?? null,
  );

  readonly estimatedInstallment = computed<number | null>(() => {
    const { requestedAmount, tenor } = this.application();
    if (!requestedAmount || !tenor) return null;

    const r = INDICATIVE_ANNUAL_RATE / 12;
    const factor = Math.pow(1 + r, tenor);
    return (requestedAmount * r * factor) / (factor - 1);
  });

  readonly timeline = computed<TimelineEntry[]>(() => {
    const app = this.application();
    const entries: TimelineEntry[] = [];

    entries.push({
      key: 'submitted',
      title: 'Application submitted',
      actor: app.customer?.customerName ?? null,
      note: null,
      date: app.submissionDate ?? null,
      tone: 'neutral',
    });

    const review = app.review;
    if (review) {
      const rejected = (review.recommendation ?? '').toUpperCase().includes('REJECT');
      entries.push({
        key: 'review',
        title: rejected ? 'Rejected by marketing' : 'Marketing recommended approval',
        actor: review.marketing?.fullName ?? null,
        note: review.reviewNote ?? null,
        date: review.uploadedAt ?? null,
        tone: rejected ? 'negative' : 'positive',
      });
    }

    // The API serialises the branch manager decision under `bmdecision`.
    const decision = app.bmdecision;
    if (decision) {
      const approved = (decision.decision ?? '').toUpperCase() === 'APPROVED';
      entries.push({
        key: 'decision',
        title: approved ? 'Approved by branch manager' : 'Rejected by branch manager',
        actor: decision.branchManager?.fullName ?? null,
        note: decision.decisionNote ?? null,
        date: decision.decidedAt ?? null,
        tone: approved ? 'positive' : 'negative',
      });
    }

    for (const verification of app.verifications ?? []) {
      const failed = this.isFailedCall(verification.callStatus);
      entries.push({
        key: `verification-${verification.verificationId}`,
        title: `Back office verification — ${verification.callStatus ?? 'recorded'}`,
        actor: verification.verifiedBy?.fullName ?? null,
        note: verification.verificationNote ?? null,
        date: verification.verificationDate ?? null,
        tone: failed ? 'negative' : 'positive',
      });
    }

    const disbursement = app.disbursement;
    if (disbursement) {
      entries.push({
        key: 'disbursement',
        title: `Disbursed ${this.formatRupiah(disbursement.disbursedAmount)}`,
        actor: disbursement.processedBy?.fullName ?? null,
        note:
          [disbursement.bankName, disbursement.accountNumber].filter(Boolean).join(' · ') || null,
        date: disbursement.disbursementDate ?? null,
        tone: 'positive',
      });
    }

    return entries;
  });

  // ---- document preview ----

  /** The document the preview modal is showing, or null when it is closed. */
  readonly previewDocument = signal<LoanDocumentResponse | null>(null);

  openPreview(doc: LoanDocumentResponse): void {
    this.previewDocument.set(doc);
  }

  closePreview(): void {
    this.previewDocument.set(null);
  }

  // ---- formatting ----

  readonly documentTabLabel = (doc: LoanDocumentResponse): string =>
    (doc.documentType ?? '')
      .split('_')
      .filter(Boolean)
      .map((part) => {
        const upper = part.toUpperCase();
        return DOCUMENT_ACRONYMS.has(upper)
          ? upper
          : upper.charAt(0) + part.slice(1).toLowerCase();
      })
      .join(' ') || 'Document';

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
    return `${years} ${years === 1 ? 'year' : 'years'} ${rest} months`;
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

  toneDotClass(tone: TimelineTone): string {
    switch (tone) {
      case 'positive':
        return 'bg-green-600 ring-green-100';
      case 'negative':
        return 'bg-red-600 ring-red-100';
      default:
        return 'bg-slate-400 ring-slate-100';
    }
  }

  private isFailedCall(callStatus: string | null | undefined): boolean {
    if (!callStatus) return false;
    const upper = callStatus.toUpperCase();
    return FAILED_CALL_MARKERS.some((marker) => upper.includes(marker));
  }

  @HostListener('document:keydown.escape')
  close(): void {
    this.closed.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.close();
  }
}
