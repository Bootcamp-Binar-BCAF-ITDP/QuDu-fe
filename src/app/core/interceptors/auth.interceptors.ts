import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { REQUIRES_AUTH } from '../context/auth-context';
import { AuthService } from '../services/auth.services';

const withToken = (request: HttpRequest<unknown>, token: string) =>
  request.clone({ setHeaders: { Authorization: `Bearer ${token}` } });

const isRefreshCall = (url: string) => url.includes('/api/auth/refresh');

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  if (!request.context.get(REQUIRES_AUTH) || !token) {
    return next(request);
  }

  return next(withToken(request, token)).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401 || isRefreshCall(request.url)) {
        return throwError(() => error);
      }

      if (!authService.getRefreshToken()) {
        authService.expireSession();
        return throwError(() => error);
      }

      return authService.refresh().pipe(
        switchMap((response) => next(withToken(request, response.token))),
        catchError(() => {
          authService.expireSession();
          return throwError(() => error);
        }),
      );
    }),
  );
};
