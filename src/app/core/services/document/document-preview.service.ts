import { environment } from '../../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { getProtectedBlob } from '../../../shared/utils/httpUtils.utils';

const API_ORIGIN = environment.apiOrigin;

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'];

export interface PreviewableDocument {
  documentId?: number | null;
  documentType?: string | null;
  fileName?: string | null;
}

@Injectable({ providedIn: 'root' })
export class DocumentPreviewService {
  private readonly http = inject(HttpClient);

  contentAt(url: string): Observable<Blob> {
    return getProtectedBlob(this.http, url);
  }

  loanDocumentUrl(applicationId: string, documentId: number): string {
    return `${API_ORIGIN}/api/loan-applications/${applicationId}/documents/${documentId}/content`;
  }

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
