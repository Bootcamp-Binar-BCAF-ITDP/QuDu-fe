import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, expand, first, map } from 'rxjs';
import { PageResponse } from '../../../models/common/app.models';
import {
  PlafondDecisionBody,
  PlafondRequestItem,
} from '../../../models/plafond-request/plafond-request.models';
import { ApiResponse } from '../../../shared/utils/apiResponse.component';
import { getProtected } from '../../../shared/utils/httpUtils.utils';
import { REQUIRES_AUTH } from '../../context/auth-context';

const API_ORIGIN = 'http://localhost:8080';

/** Page size used when walking the bucket to find a single request. */
const LOOKUP_PAGE_SIZE = 100;

export interface PlafondBucketQuery {
  page?: number;
  size?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

@Injectable({ providedIn: 'root' })
export class PlafondRequestService {
  private readonly http = inject(HttpClient);

  private readonly apiUrl = `${API_ORIGIN}/api/bm/plafond-requests`;

  /**
   * The branch manager queue. Backed by findByStatus(PENDING), so decided
   * requests drop out of it — there is no search parameter on the server.
   */
  bucket(query: PlafondBucketQuery = {}): Observable<PageResponse<PlafondRequestItem>> {
    const { page = 0, size = 10, sortBy = 'requestDate', sortDir = 'asc' } = query;

    const params = new HttpParams()
      .set('page', page)
      .set('size', size)
      .set('sort', `${sortBy},${sortDir}`);

    return getProtected<PageResponse<PlafondRequestItem>>(this.http, this.apiUrl, params).pipe(
      map((res) => res.data),
    );
  }

  /**
   * The server exposes no GET-by-id, so the review page walks the bucket until
   * it finds the request. Resolves to null once the last page is exhausted,
   * which is also what a request that has already been decided looks like.
   */
  findOne(requestId: string): Observable<PlafondRequestItem | null> {
    return this.bucket({ page: 0, size: LOOKUP_PAGE_SIZE }).pipe(
      expand((res) =>
        res.last ? EMPTY : this.bucket({ page: res.page + 1, size: LOOKUP_PAGE_SIZE }),
      ),
      map((res) => (res.content ?? []).find((row) => row.requestId === requestId) ?? null),
      first((found) => found !== null, null),
    );
  }

  /** PENDING -> APPROVED or REJECTED. Returns the request as it now stands. */
  decide(requestId: string, body: PlafondDecisionBody): Observable<PlafondRequestItem> {
    const context = new HttpContext().set(REQUIRES_AUTH, true);

    return this.http
      .put<ApiResponse<PlafondRequestItem>>(`${this.apiUrl}/${requestId}/decision`, body, {
        context,
      })
      .pipe(map((res) => res.data));
  }
}
