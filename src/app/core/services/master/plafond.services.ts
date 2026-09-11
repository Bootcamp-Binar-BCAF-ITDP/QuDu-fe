import { environment } from '../../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
  deleteProtected,
  getProtected,
  postProtected,
  putProtected,
} from '../../../shared/utils/httpUtils.utils';
import { PageParams, PageResponse } from '../../../models/common/app.models';
import { Plafond, PlafondRequest } from '../../../models/master/plafond.models';
import { Observable } from 'rxjs';
import { ApiResponse } from '../../../shared/utils/apiResponse.component';

@Injectable({
  providedIn: 'root',
})
export class PlafondService {
  private readonly apiUrl = `${environment.apiOrigin}/api/plafonds`;

  constructor(private readonly http: HttpClient) {}

  getAllPlafonds(params: PageParams = {}): Observable<ApiResponse<PageResponse<Plafond>>> {
    const { page = 0, size = 5, sortBy = 'plafondId', sortDir = 'asc', search = '' } = params;

    return getProtected<PageResponse<Plafond>>(this.http, this.apiUrl, {
      page,
      size,
      sortBy,
      sortDir,
      search,
    });
  }

  addPlafond(request: PlafondRequest): Observable<ApiResponse<PlafondRequest>> {
    return postProtected<PlafondRequest>(this.http, this.apiUrl, request);
  }

  updatePlafond(
    plafondId: number,
    request: PlafondRequest,
  ): Observable<ApiResponse<PlafondRequest>> {
    return putProtected<PlafondRequest>(this.http, `${this.apiUrl}/${plafondId}`, request);
  }

  deletePlafond(plafondId: number): Observable<ApiResponse<void>> {
    return deleteProtected<void>(this.http, `${this.apiUrl}/${plafondId}`);
  }
}
