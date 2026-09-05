import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { REQUIRES_AUTH } from '../../core/context/auth-context';
import { Observable } from 'rxjs';
import { ApiResponse } from './apiResponse.component';

export type QueryParams = Record<string, string | number | boolean | null | undefined>;

const buildParams = (params?: QueryParams): HttpParams => {
  let httpParams = new HttpParams();

  if (!params) {
    return httpParams;
  }

  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      httpParams = httpParams.set(key, String(value));
    }
  });

  return httpParams;
};

export const getProtected = <T>(
  http: HttpClient,
  url: string,
  params?: QueryParams | HttpParams,
): Observable<ApiResponse<T>> => {
  const context = new HttpContext().set(REQUIRES_AUTH, true);

  return http.get<ApiResponse<T>>(url, {
    context,
    params: params instanceof HttpParams ? params : buildParams(params),
  });
};

/**
 * A protected GET that returns raw bytes instead of the ApiResponse envelope.
 *
 * Needed because a browser will not put an Authorization header on an
 * `<img src>` or `<iframe src>`, so a JWT-guarded file cannot be pointed at
 * directly. Fetching it here runs it through the interceptor like any other
 * call; the caller turns the Blob into an object URL for the element to show.
 */
export const getProtectedBlob = (http: HttpClient, url: string): Observable<Blob> => {
  const context = new HttpContext().set(REQUIRES_AUTH, true);

  return http.get(url, { context, responseType: 'blob' });
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
