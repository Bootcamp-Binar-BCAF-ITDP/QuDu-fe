import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  inject,
  signal,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import {
  DocumentPreviewService,
  PreviewableDocument,
} from '../../../core/services/document/document-preview.service';

@Component({
  selector: 'app-document-preview-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './document-preview-modal.component.html',
})
export class DocumentPreviewModalComponent implements OnChanges, OnDestroy {
  private readonly service = inject(DocumentPreviewService);
  private readonly sanitizer = inject(DomSanitizer);

  @Input() contentUrl: string | null = null;

  @Input() document: PreviewableDocument | null = null;

  @Output() close = new EventEmitter<void>();

  readonly current = signal<PreviewableDocument | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly objectUrl = signal<string | null>(null);

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

  ngOnChanges(): void {
    this.current.set(this.document);
    this.load(this.document);
  }

  private load(document: PreviewableDocument | null): void {
    this.release();
    this.error.set(null);

    if (!document || !this.contentUrl) {
      return;
    }

    this.loading.set(true);

    this.service.contentAt(this.contentUrl).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        this.objectUrl.set(url);
        this.frameUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
        this.loading.set(false);
      },
      error: () => {
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
