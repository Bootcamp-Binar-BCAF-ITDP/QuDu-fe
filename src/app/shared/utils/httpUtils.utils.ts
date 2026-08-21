import { HttpClient, HttpContext } from '@angular/common/http';
import { REQUIRES_AUTH } from '../../core/context/auth-context';
import { Observable } from 'rxjs';
import { ApiResponse } from './apiResponse.component';

export const getProtected = <T>(http: HttpClient, url: string): Observable<ApiResponse<T>> => {
  const context = new HttpContext().set(REQUIRES_AUTH, true);

  return http.get<ApiResponse<T>>(url, { context });
};

export const postProtected = <T>(
  http: HttpClient,
  url: string,
  body: T,
): Observable<ApiResponse<T>> => {
  const context = new HttpContext().set(REQUIRES_AUTH, true);

  return http.post<ApiResponse<T>>(url, body, { context, responseType: 'json' as 'json' });
};

export const putProtected = <T>(
  http: HttpClient,
  url: string,
  body: T,
): Observable<ApiResponse<T>> => {
  const context = new HttpContext().set(REQUIRES_AUTH, true);

  return http.put<ApiResponse<T>>(url, body, { context, responseType: 'json' as 'json' });
};

export const deleteProtected = <T>(http: HttpClient, url: string): Observable<ApiResponse<T>> => {
  const context = new HttpContext().set(REQUIRES_AUTH, true);

  return http.delete<ApiResponse<T>>(url, { context, responseType: 'json' as 'json' });
};
