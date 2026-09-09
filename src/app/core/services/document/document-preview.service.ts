import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { getProtectedBlob } from '../../../shared/utils/httpUtils.utils';

const API_ORIGIN = 'http://localhost:8080';

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'];

/**
 * Fetches the bytes behind a loan document so a reviewer can read it in a modal.
 *
 * One service rather than a method on each review page's own service: the bucket
 * page and the applications page both show the same documents, and each already
 * carries its own copy of a `documentUrl` helper - a third copy of this would
 * have been the one that drifted.
 *
 * Note the endpoint is under /api/loan-applications/**, which SecurityConfig
 * opens to marketing, branch manager and back office. A customer token cannot
 * read it, which is why the Android app has no preview.
 */
/**
 * The little a preview needs to know about a document, so the modal works for
 * loan-application and plafond-request paperwork alike without either DTO
 * having to learn about the other.
 */
export interface PreviewableDocument {
  documentId?: number | null;
  documentType?: string | null;
  fileName?: string | null;
}

@Injectable({ providedIn: 'root' })
export class DocumentPreviewService {
  private readonly http = inject(HttpClient);

  /** Fetches whatever the caller's URL points at. See the two builders below. */
  contentAt(url: string): Observable<Blob> {
    return getProtectedBlob(this.http, url);
  }

  loanDocumentUrl(applicationId: string, documentId: number): string {
    return `${API_ORIGIN}/api/loan-applications/${applicationId}/documents/${documentId}/content`;
  }

  /** Branch-manager only; the endpoint sits under /api/bm/**. */
  plafondDocumentUrl(requestId: string, documentId: number): string {
    return `${API_ORIGIN}/api/bm/plafond-requests/${requestId}/documents/${documentId}/content`;
  }

  extension(document: PreviewableDocument | null | undefined): string {
    const match = /\.([a-z0-9]+)$/i.exec(document?.fileName ?? '');
    return match ? match[1].toLowerCase() : '';
  }

  isImage(document: PreviewableDocument | null | undefined): boolean {
    return IMAGE_EXTENSIONS.includes(this.extension(document));
  }

  isPdf(document: PreviewableDocument | null | undefined): boolean {
    return this.extension(document) === 'pdf';
  }

  /** 'SLIP_GAJI' -> 'Slip Gaji'; acronyms such as KTP and KK stay upper case. */
  label(document: PreviewableDocument | null | undefined): string {
    const acronyms = new Set(['KTP', 'KK', 'NPWP', 'ID']);

    return (
      (document?.documentType ?? '')
        .split('_')
        .filter(Boolean)
        .map((part) => {
          const upper = part.toUpperCase();
          return acronyms.has(upper) ? upper : upper.charAt(0) + part.slice(1).toLowerCase();
        })
        .join(' ') || 'Document'
    );
  }
}
