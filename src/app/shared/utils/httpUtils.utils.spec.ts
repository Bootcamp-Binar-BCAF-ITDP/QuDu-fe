import { HttpClient, HttpParams, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { REQUIRES_AUTH } from '../../core/context/auth-context';
import {
  deleteProtected,
  getProtected,
  getProtectedBlob,
  postProtected,
  putProtected,
} from './httpUtils.utils';

const URL = 'https://api.test/api/branches';

describe('the protected http helpers', () => {
  let http: HttpClient;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('marks a GET as needing a token, which is the only thing that makes the interceptor attach one', () => {
    getProtected(http, URL).subscribe();

    const req = backend.expectOne(URL);
    expect(req.request.context.get(REQUIRES_AUTH)).toBe(true);
    req.flush({});
  });

  it('marks POST, PUT and DELETE the same way', () => {
    postProtected(http, URL, { a: 1 }).subscribe();
    putProtected(http, URL, { a: 1 }).subscribe();
    deleteProtected(http, URL).subscribe();

    for (const req of backend.match(URL)) {
      expect(req.request.context.get(REQUIRES_AUTH)).toBe(true);
      req.flush({});
    }
  });

  it('marks a blob download too, or a document preview downloads a 401 page', () => {
    getProtectedBlob(http, URL).subscribe();

    const req = backend.expectOne(URL);
    expect(req.request.context.get(REQUIRES_AUTH)).toBe(true);
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['x']));
  });

  it('leaves a plain HttpClient call unmarked, which is why it would 401 on a guarded route', () => {
    http.get(URL).subscribe();

    const req = backend.expectOne(URL);
    expect(req.request.context.get(REQUIRES_AUTH)).toBe(false);
    req.flush({});
  });

  it('sends the method the caller asked for', () => {
    postProtected(http, URL, {}).subscribe();
    expect(backend.expectOne(URL).request.method).toBe('POST');
    backend.verify();

    putProtected(http, URL, {}).subscribe();
    expect(backend.expectOne(URL).request.method).toBe('PUT');
    backend.verify();

    deleteProtected(http, URL).subscribe();
    expect(backend.expectOne(URL).request.method).toBe('DELETE');
  });

  it('passes the body through untouched', () => {
    const body = { branchName: 'Jakarta Pusat' };
    postProtected(http, URL, body).subscribe();

    const req = backend.expectOne(URL);
    expect(req.request.body).toEqual(body);
    req.flush({});
  });
});

describe('query parameter building', () => {
  let http: HttpClient;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  const paramsOf = () => {
    const req = backend.expectOne((r) => r.url === URL);
    req.flush({});
    return req.request.params;
  };

  it('sends no query string when no parameters were given', () => {
    getProtected(http, URL).subscribe();
    expect(paramsOf().keys()).toEqual([]);
  });

  it('stringifies numbers and booleans, since HttpParams only carries strings', () => {
    getProtected(http, URL, { page: 0, size: 10, active: true }).subscribe();

    const params = paramsOf();
    expect(params.get('page')).toBe('0');
    expect(params.get('size')).toBe('10');
    expect(params.get('active')).toBe('true');
  });

  it('keeps page zero, which a falsy check would have dropped and silently paged wrong', () => {
    getProtected(http, URL, { page: 0 }).subscribe();
    expect(paramsOf().get('page')).toBe('0');
  });

  it('keeps false for the same reason', () => {
    getProtected(http, URL, { active: false }).subscribe();
    expect(paramsOf().get('active')).toBe('false');
  });

  it('drops null, undefined and the empty string, so a cleared filter disappears from the URL', () => {
    getProtected(http, URL, { search: '', from: null, to: undefined, page: 1 }).subscribe();

    const params = paramsOf();
    expect(params.keys()).toEqual(['page']);
  });

  it('passes a prebuilt HttpParams straight through, keeping repeated keys intact', () => {
    const prebuilt = new HttpParams()
      .set('page', '0')
      .append('status', 'CHECKING')
      .append('status', 'VERIFIED');

    getProtected(http, URL, prebuilt).subscribe();

    const params = paramsOf();
    expect(params.getAll('status')).toEqual(['CHECKING', 'VERIFIED']);
    expect(params.get('page')).toBe('0');
  });

  it('does not mutate the HttpParams it was handed', () => {
    const prebuilt = new HttpParams().set('page', '0');

    getProtected(http, URL, prebuilt).subscribe();
    paramsOf();

    expect(prebuilt.keys()).toEqual(['page']);
  });
});
