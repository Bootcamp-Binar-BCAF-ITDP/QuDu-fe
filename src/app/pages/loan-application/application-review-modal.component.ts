import { DatePipe } from '@angular/common';
import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LoanApplication, LoanDocumentResponse, LoanStatus } from '../../models/loan-application/loan-application.models';


export interface ReviewDecision {
  applicationId: string;
  approve: boolean;
  note: string;
}

const INDICATIVE_ANNUAL_RATE = 0.12;

@Component({
  selector: 'app-application-review-modal',
  standalone: true,
  imports: [DatePipe, FormsModule],
  templateUrl: 'application-review-modal.component.html',
})
export class ApplicationReviewModalComponent implements OnDestroy {
  readonly application = input.required<LoanApplication>();
  readonly submitting = input(false);

  readonly closed = output<void>();
  readonly decided = output<ReviewDecision>();
  readonly revisionRequested = output<ReviewDecision>();

  //state
  readonly note = signal('');
  readonly activeDocumentId = signal<number | null>(null);
  readonly draftSavedAt = signal<Date | null>(null);

  @ViewChild('closeButton') private closeButton?: ElementRef<HTMLButtonElement>;

  private readonly previouslyFocused = document.activeElement as HTMLElement | null;

  constructor() {
    document.body.classList.add('overflow-hidden');

    // Reset the document tab whenever a different application is shown.
    effect(() => {
      const docs = this.documents();
      this.activeDocumentId.set(docs.length ? docs[0].documentId : null);
    });
  }

  ngOnDestroy(): void {
    document.body.classList.remove('overflow-hidden');
    this.previouslyFocused?.focus();
  }

  readonly documents = computed<LoanDocumentResponse[]>(() => this.application().documents ?? []);

  readonly activeDocument = computed<LoanDocumentResponse | null>(() => {
    const id = this.activeDocumentId();
    return this.documents().find((d) => d.documentId === id) ?? null;
  });

  readonly actionable = computed(() => this.application().status === LoanStatus.CHECKING);

  readonly estimatedInstallment = computed(() => {
    const { requestedAmount, tenor } = this.application();
    if (!requestedAmount || !tenor) return null;

    const r = INDICATIVE_ANNUAL_RATE / 12;
    const factor = Math.pow(1 + r, tenor);
    return (requestedAmount /r /factor) / (factor - 1);
  });

  readonly incomeVariance = computed(() => {
    const stated = this.application().income;
    const verified = this.application().customer?.verifiedMonthlyIncome;
    if (!stated || verified == null) return null;
    return (verified - stated) / stated;
  });

  readonly documentTabLabel = (doc: LoanDocumentResponse): string =>
    doc.documentType
      .split('_')
      .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
      .join(' ');

  // formatting

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

  //actions /

  @HostListener('document:keydown.escape')
  close(): void {
    this.closed.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.close();
  }

  approve(): void {
    this.decided.emit({
      applicationId: this.application().applicationId,
      approve: true,
      note: this.note().trim(),
    });
  }

  reject(): void {
    this.decided.emit({
      applicationId: this.application().applicationId,
      approve: false,
      note: this.note().trim(),
    });
  }

  requestRevision(): void {
    this.revisionRequested.emit({
      applicationId: this.application().applicationId,
      approve: false,
      note: this.note().trim(),
    });
  }

  saveDraft(): void {
    // Local only — there is no draft endpoint. Swap in a real call when there is.
    this.draftSavedAt.set(new Date());
  }
}
