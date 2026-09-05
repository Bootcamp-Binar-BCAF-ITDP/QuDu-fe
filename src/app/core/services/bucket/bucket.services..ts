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
  private readonly disburseUrl = `${API_ORIGIN}/api/loan-disbursements`;

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

  // documentUrl() lived here and pointed at ${API_ORIGIN}/uploads/... built from
  // the stored filesystem path. Nothing serves /uploads/** and Spring Security
  // answers 401 there, so it never resolved. Documents now come from
  // DocumentPreviewService, which fetches the real endpoint as a Blob.

  disbursementBucket(query: {
    page: number;
    size: number;
    sortBy: string;
    sortDir: string;
    search: string;
  }): Observable<PageResponse<BucketItem>> {
    let params = new HttpParams()
      .set('page', query.page)
      .set('size', query.size)
      .set('sort', `${query.sortBy},${query.sortDir}`);

    const search = query.search?.trim();
    if (search) {
      params = params.set('search', search);
    }

    return getProtected<PageResponse<BucketItem>>(
      this.http,
      `${this.disburseUrl}`,
      params,
    ).pipe(map((res) => res.data));
  }
}
