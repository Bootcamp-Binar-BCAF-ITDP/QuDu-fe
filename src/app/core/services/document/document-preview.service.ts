import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { LoanDocumentResponse } from '../../../models/loan-application/loan-application.models';
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
@Injectable({ providedIn: 'root' })
export class DocumentPreviewService {
  private readonly http = inject(HttpClient);

  content(applicationId: string, documentId: number): Observable<Blob> {
    return getProtectedBlob(
      this.http,
      `${API_ORIGIN}/api/loan-applications/${applicationId}/documents/${documentId}/content`,
    );
  }

  extension(document: LoanDocumentResponse | null | undefined): string {
    const match = /\.([a-z0-9]+)$/i.exec(document?.fileName ?? '');
    return match ? match[1].toLowerCase() : '';
  }

  isImage(document: LoanDocumentResponse | null | undefined): boolean {
    return IMAGE_EXTENSIONS.includes(this.extension(document));
  }

  isPdf(document: LoanDocumentResponse | null | undefined): boolean {
    return this.extension(document) === 'pdf';
  }

  /** 'SLIP_GAJI' -> 'Slip Gaji'; acronyms such as KTP and KK stay upper case. */
  label(document: LoanDocumentResponse | null | undefined): string {
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
