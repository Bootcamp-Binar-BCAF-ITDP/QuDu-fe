import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../../environments/environment';
import { DASHBOARD_PERIODS } from '../../../models/dashboard/dashboard.models';
import { DashboardService } from './dashboard.services';

const URL = `${environment.apiOrigin}/api/dashboard`;

describe('DashboardService', () => {
  let service: DashboardService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    backend = TestBed.inject(HttpTestingController);
    service = TestBed.inject(DashboardService);
  });

  afterEach(() => backend.verify());

  const expectGet = () => backend.expectOne((r) => r.url === URL);

  it('asks for the period the caller chose', () => {
    service.getDashboard('THIS_MONTH').subscribe();

    const req = expectGet();
    expect(req.request.params.get('period')).toBe('THIS_MONTH');
    req.flush({ data: {} });
  });

  it('accepts every period the model declares, so no tab silently sends a bad value', () => {
    for (const period of DASHBOARD_PERIODS) {
      service.getDashboard(period).subscribe();

      const req = expectGet();
      expect(req.request.params.get('period')).toBe(period);
      req.flush({ data: {} });
    }
  });

  it('sends a custom range when both ends are given', () => {
    service.getDashboard('THIS_MONTH', '2026-09-01', '2026-09-15').subscribe();

    const req = expectGet();
    expect(req.request.params.get('from')).toBe('2026-09-01');
    expect(req.request.params.get('to')).toBe('2026-09-15');
    req.flush({ data: {} });
  });

  it('sends no range when only one end is filled in, so a half-typed filter is ignored', () => {
    service.getDashboard('THIS_MONTH', '2026-09-01').subscribe();

    const req = expectGet();
    expect(req.request.params.has('from')).toBe(false);
    expect(req.request.params.has('to')).toBe(false);
    req.flush({ data: {} });
  });

  it('sends no range when neither end is given', () => {
    service.getDashboard('LAST_7_DAYS').subscribe();

    const req = expectGet();
    expect(req.request.params.keys()).toEqual(['period']);
    req.flush({ data: {} });
  });

  it('unwraps the envelope, so the component binds the dashboard and not the wrapper', () => {
    let received: unknown;
    service.getDashboard('THIS_MONTH').subscribe((d) => (received = d));

    expectGet().flush({
      data: { summary: { totalApplications: { value: 12, changePercent: null, direction: 'FLAT' } } },
    });

    expect(received).toMatchObject({ summary: { totalApplications: { value: 12 } } });
  });

  it('reads it with GET', () => {
    service.getDashboard('THIS_MONTH').subscribe();

    const req = expectGet();
    expect(req.request.method).toBe('GET');
    req.flush({ data: {} });
  });
});
