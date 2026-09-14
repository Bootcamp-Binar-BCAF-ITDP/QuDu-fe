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

  /**
   * A custom window overrides the preset on the server. Both dates must be
   * sent together or neither, which is why they are widened here rather than
   * passed through one at a time.
   */
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
