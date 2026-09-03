import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { catchError, EMPTY, Observable, tap, throwError } from 'rxjs';
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
  private readonly apiUrl = 'http://localhost:8080/api/auth';

  private readonly baseUrl = 'http://localhost:8080/api';

  private readonly TOKEN_KEY = 'access_token';

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
  ) {}

  login(request: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, request).pipe(
      tap((response: LoginResponse) => {
        if (response.token) {
          localStorage.setItem(this.TOKEN_KEY, response.token);
          localStorage.setItem(this.USER_KEY, JSON.stringify(response));
          this.authState.set(response as unknown as StoredAuth);
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

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.authState.set(null);
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
