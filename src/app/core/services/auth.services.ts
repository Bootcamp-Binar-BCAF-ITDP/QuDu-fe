import { environment } from '../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { catchError, EMPTY, Observable, finalize, shareReplay, tap, throwError } from 'rxjs';
import {
  ForgotPasswordRequest,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  ResetPasswordRequest,
} from '../../models/auth.models';
import { ApiResponse } from '../../shared/utils/apiResponse.component';
import { Role } from '../../models/master/role.models';
import { Branch } from '../../models/master/branch.models';
import { Router } from '@angular/router';
import { Menu } from '../../models/master/menu.models';

interface StoredAuth {
  token: string;
  userId: string;
  username: string;
  role: string;
  email: string;
  fullName: string;
  menus: Menu[];
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly apiUrl = `${environment.apiOrigin}/api/auth`;

  private readonly baseUrl = `${environment.apiOrigin}/api`;

  private readonly TOKEN_KEY = 'access_token';

  private readonly REFRESH_KEY = 'refresh_token';

  private readonly EXPIRY_KEY = 'access_expires_at';

  private renewalTimer: ReturnType<typeof setTimeout> | null = null;

  private inFlightRefresh: Observable<LoginResponse> | null = null;

  private readonly USER_KEY = 'current_user';

  private readonly STORAGE_KEY = 'auth';

  private authState = signal<StoredAuth | null>(this.loadFromStorage());

  private loadFromStorage(): StoredAuth | null {
    const raw = localStorage.getItem(this.USER_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router,
  ) {
    this.scheduleRenewal();
  }

  login(request: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, request).pipe(
      tap((response: LoginResponse) => {
        if (response.token) {
          this.storeSession(response);
        }
      }),
      catchError((err) => {
        console.error('Login request failed:', err);
        return throwError(() => err);
      }),
    );
  }

  register(request: RegisterRequest): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${this.apiUrl}/register`, request).pipe(
      tap((response: RegisterResponse) => {
        return response;
      }),
    );
  }

  getRoles(): Observable<ApiResponse<Role[]>> {
    return this.http.get<ApiResponse<Role[]>>(`${this.baseUrl}/roles`);
  }

  getBranches(): Observable<ApiResponse<Branch[]>> {
    return this.http.get<ApiResponse<Branch[]>>(`${this.baseUrl}/branches`);
  }

  forgotPassword(request: ForgotPasswordRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/forgot-password`, request);
  }

  resetPassword(request: ResetPasswordRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/reset-password`, request);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_KEY);
  }

  hasUsableSession(): boolean {
    if (!this.getToken()) return false;

    const expiresAt = this.getAccessExpiry();

    if (expiresAt === null) return true;

    if (Date.now() < expiresAt) return true;

    return !!this.getRefreshToken();
  }

  private storeSession(response: LoginResponse): void {
    localStorage.setItem(this.TOKEN_KEY, response.token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(response));

    if (response.refreshToken) {
      localStorage.setItem(this.REFRESH_KEY, response.refreshToken);
    }

    if (response.expiresIn) {
      const expiresAt = Date.now() + response.expiresIn * 1000;
      localStorage.setItem(this.EXPIRY_KEY, String(expiresAt));
    }

    this.authState.set(response as unknown as StoredAuth);
    this.scheduleRenewal();
  }

  getAccessExpiry(): number | null {
    const raw = localStorage.getItem(this.EXPIRY_KEY);
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) ? parsed : null;
  }

  private scheduleRenewal(): void {
    this.cancelRenewal();

    const expiresAt = this.getAccessExpiry();
    if (expiresAt === null || !this.getRefreshToken()) return;

    const life = expiresAt - Date.now();
    const margin = Math.min(30_000, Math.max(life / 3, 0));
    const delay = Math.max(life - margin, 0);

    this.renewalTimer = setTimeout(() => this.renewNow(), delay);
  }

  private cancelRenewal(): void {
    if (this.renewalTimer !== null) {
      clearTimeout(this.renewalTimer);
      this.renewalTimer = null;
    }
  }

  private renewNow(): void {
    this.refresh().subscribe({
      error: () => this.expireSession(),
    });
  }

  expireSession(): void {
    const returnUrl = this.router.url;

    this.clearSession();
    this.router.navigate(['/login'], {
      replaceUrl: true,
      queryParams: { returnUrl, reason: 'expired' },
    });
  }

  refresh(): Observable<LoginResponse> {
    if (this.inFlightRefresh) return this.inFlightRefresh;

    const refreshToken = this.getRefreshToken();

    if (!refreshToken) {
      return throwError(() => new Error('No refresh token stored'));
    }

    this.inFlightRefresh = this.http
      .post<LoginResponse>(`${this.apiUrl}/refresh`, { refreshToken })
      .pipe(
        tap((response) => this.storeSession(response)),
        finalize(() => (this.inFlightRefresh = null)),
        shareReplay({ bufferSize: 1, refCount: false }),
      );

    return this.inFlightRefresh;
  }

  clearSession(): void {
    this.cancelRenewal();
    this.inFlightRefresh = null;

    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_KEY);
    localStorage.removeItem(this.EXPIRY_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.authState.set(null);
  }

  logout(): void {
    const refreshToken = this.getRefreshToken();

    if (refreshToken) {
      this.http.post(`${this.apiUrl}/logout`, { refreshToken }).subscribe({
        error: () => undefined,
      });
    }

    this.clearSession();
    this.router.navigate(['/login']);
  }

  user(): any {
    const user = localStorage.getItem(this.USER_KEY);
    return user ? JSON.parse(user) : null;
  }

  getMenus(): Menu[] {
    return this.authState()?.menus || [];
  }

  hasMenu(menuName: string): boolean {
    return this.getMenus().some(
      (m) => m.menuName.toLowerCase() === menuName.toLowerCase(),
    );
  }
}
