import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  inject,
  signal,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { DocumentPreviewService } from '../../../core/services/document/document-preview.service';
import { LoanDocumentResponse } from '../../../models/loan-application/loan-application.models';

/**
 * Reads a loan document in place, so a reviewer never has to download a KTP
 * onto their machine to look at it.
 *
 * The file is pulled as a Blob rather than pointed at directly, because the
 * endpoint is JWT-guarded and a browser puts no Authorization header on an
 * `<img src>`. The Blob becomes an object URL, which is also what the download
 * link uses - so saving a copy costs no second request.
 *
 * Object URLs are revoked on close and on destroy. Without that, every document
 * opened would pin its bytes in memory for the life of the tab.
 */
@Component({
  selector: 'app-document-preview-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './document-preview-modal.component.html',
})
export class DocumentPreviewModalComponent implements OnDestroy {
  private readonly service = inject(DocumentPreviewService);
  private readonly sanitizer = inject(DomSanitizer);

  @Input() applicationId: string | null = null;

  @Input() set document(value: LoanDocumentResponse | null) {
    this.current.set(value);
    this.load(value);
  }

  @Output() close = new EventEmitter<void>();

  readonly current = signal<LoanDocumentResponse | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  /** Raw object URL, used by <img> and by the download link. */
  readonly objectUrl = signal<string | null>(null);

  /** The same URL, waved past the sanitizer so an <iframe> will take it. */
  readonly frameUrl = signal<SafeResourceUrl | null>(null);

  get isImage(): boolean {
    return this.service.isImage(this.current());
  }

  get isPdf(): boolean {
    return this.service.isPdf(this.current());
  }

  get title(): string {
    return this.service.label(this.current());
  }

  get fileName(): string {
    return this.current()?.fileName ?? 'document';
  }

  closeModal(): void {
    this.release();
    this.close.emit();
  }

  ngOnDestroy(): void {
    this.release();
  }

  private load(document: LoanDocumentResponse | null): void {
    this.release();
    this.error.set(null);

    if (!document || !this.applicationId || document.documentId == null) {
      return;
    }

    this.loading.set(true);

    this.service.content(this.applicationId, document.documentId).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        this.objectUrl.set(url);
        this.frameUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
        this.loading.set(false);
      },
      error: () => {
        // The row can outlive the file - uploads/ is routinely wiped between
        // dev runs - so this is a normal outcome, not an exceptional one.
        this.error.set('Document could not be loaded. It may no longer be stored on the server.');
        this.loading.set(false);
      },
    });
  }

  private release(): void {
    const url = this.objectUrl();
    if (url) URL.revokeObjectURL(url);

    this.objectUrl.set(null);
    this.frameUrl.set(null);
  }
}
