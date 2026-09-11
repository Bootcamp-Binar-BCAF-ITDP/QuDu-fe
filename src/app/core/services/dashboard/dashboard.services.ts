import { environment } from '../../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { DashboardPeriod, DashboardResponse } from '../../../models/dashboard/dashboard.models';

/**
 * Matches ResponseUtil.success on the server. If your project already exports
 * this type, import it instead of redeclaring it here.
 */
interface ApiResponse<T> {
  success?: boolean;
  message?: string;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);

  /** Align this with however LoanApplicationService builds its base URL. */
  private readonly baseUrl = `${environment.apiOrigin}/api/dashboard`;

  getDashboard(period: DashboardPeriod): Observable<DashboardResponse> {
    return this.http
      .get<ApiResponse<DashboardResponse>>(this.baseUrl, { params: { period } })
      .pipe(map((response) => response.data));
  }
}
