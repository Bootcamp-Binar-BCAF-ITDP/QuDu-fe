import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, OnDestroy, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import {
  DocumentPreviewService,
  PreviewableDocument,
} from '../../../core/services/document/document-preview.service';

@Component({
  selector: 'app-document-thumbnail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './document-thumbnail.component.html',
})
export class DocumentThumbnailComponent implements OnChanges, OnDestroy {
  private readonly service = inject(DocumentPreviewService);
  private readonly sanitizer = inject(DomSanitizer);

  @Input() contentUrl: string | null = null;

  @Input() document: PreviewableDocument | null = null;

  readonly loading = signal(false);
  readonly failed = signal(false);
  readonly objectUrl = signal<string | null>(null);
  readonly frameUrl = signal<SafeResourceUrl | null>(null);

  get isImage(): boolean {
    return this.service.isImage(this.document);
  }

  get isPdf(): boolean {
    return this.service.isPdf(this.document);
  }

  get extension(): string {
    return this.service.extension(this.document).toUpperCase() || 'FILE';
  }

  ngOnChanges(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.release();
  }

  private load(): void {
    this.release();
    this.failed.set(false);

    if (!this.contentUrl || !this.document || (!this.isImage && !this.isPdf)) {
      return;
    }

    this.loading.set(true);

    this.service.contentAt(this.contentUrl).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        this.objectUrl.set(url);
        this.frameUrl.set(
          this.sanitizer.bypassSecurityTrustResourceUrl(`${url}#toolbar=0&navpanes=0&view=FitH`),
        );
        this.loading.set(false);
      },
      error: () => {
        this.failed.set(true);
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
