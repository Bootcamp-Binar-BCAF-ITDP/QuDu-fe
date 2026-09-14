import { environment } from '../../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { DashboardPeriod, DashboardResponse } from '../../../models/dashboard/dashboard.models';

interface ApiResponse<T> {
  success?: boolean;
  message?: string;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);

  private readonly baseUrl = `${environment.apiOrigin}/api/dashboard`;

  getDashboard(
    period: DashboardPeriod,
    from?: string,
    to?: string,
  ): Observable<DashboardResponse> {
    const params: Record<string, string> = { period };
    if (from && to) {
      params['from'] = from;
      params['to'] = to;
    }

    return this.http
      .get<ApiResponse<DashboardResponse>>(this.baseUrl, { params })
      .pipe(map((response) => response.data));
  }
}
