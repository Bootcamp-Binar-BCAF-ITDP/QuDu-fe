import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { PageParams, PageResponse } from '../../../models/common/app.models';
import { BucketItem } from '../../../models/bucket/bucket.models';
import { LoanDocumentResponse } from '../../../models/loan-application/loan-application.models';
import { getProtected } from '../../../shared/utils/httpUtils.utils';

const API_ORIGIN = 'http://localhost:8080';

@Injectable({ providedIn: 'root' })
export class BucketService {
  private readonly http = inject(HttpClient);

  private readonly apiUrl = `${API_ORIGIN}/api/loan-applications/bucket`;

  list(params: PageParams = {}): Observable<PageResponse<BucketItem>> {
    const {
      page = 0,
      size = 5,
      sortBy = 'submissionDate',
      sortDir = 'desc',
      search = '',
    } = params;

    let httpParams = new HttpParams()
      .set('page', page)
      .set('size', size)
      .set('sort', `${sortBy},${sortDir}`);

    const term = search.trim();
    if (term) {
      httpParams = httpParams.set('search', term);
    }

    return getProtected<PageResponse<BucketItem>>(this.http, this.apiUrl, httpParams).pipe(
      map((res) => res.data),
    );
  }

  documentUrl(document: LoanDocumentResponse | null | undefined): string {
    const raw = document?.fileUrl?.trim();
    if (!raw) return '';

    const normalized = raw.replace(/\\/g, '/');
    if (/^(https?:)?\/\//i.test(normalized) || normalized.startsWith('data:')) {
      return normalized;
    }

    return `${API_ORIGIN}/${normalized.replace(/^\/+/, '')}`;
  }
}
