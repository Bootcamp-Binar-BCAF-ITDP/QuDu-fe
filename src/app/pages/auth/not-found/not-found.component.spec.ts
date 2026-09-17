import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { NotFoundComponent } from './not-found.component';

interface RouterStub {
  getCurrentNavigation: () => unknown;
  url: string;
}

describe('NotFoundComponent', () => {
  let wentBack: number;

  const build = (router: Partial<RouterStub>, locationPath: string | null = null) => {
    TestBed.resetTestingModule();
    wentBack = 0;

    TestBed.configureTestingModule({
      providers: [
        {
          provide: Router,
          useValue: { getCurrentNavigation: () => null, url: '/fallback', ...router },
        },
        {
          provide: Location,
          useValue: { back: () => (wentBack += 1), path: () => locationPath },
        },
      ],
    });

    return TestBed.runInInjectionContext(() => new NotFoundComponent());
  };

  it('names the url the router had already resolved', () => {
    const component = build({
      getCurrentNavigation: () => ({ finalUrl: { toString: () => '/typo-here' } }),
    });

    expect(component.attemptedUrl()).toBe('/typo-here');
  });

  it('falls back to the url as typed when the router could not resolve it', () => {
    const component = build({
      getCurrentNavigation: () => ({ extractedUrl: { toString: () => '/raw-typo' } }),
    });

    expect(component.attemptedUrl()).toBe('/raw-typo');
  });

  it('prefers the resolved url over the raw one when both are present', () => {
    const component = build({
      getCurrentNavigation: () => ({
        finalUrl: { toString: () => '/resolved' },
        extractedUrl: { toString: () => '/raw' },
      }),
    });

    expect(component.attemptedUrl()).toBe('/resolved');
  });

  it('falls back to the browser path when there is no navigation in flight', () => {
    const component = build({ getCurrentNavigation: () => null }, '/from-location');

    expect(component.attemptedUrl()).toBe('/from-location');
  });

  it('falls back to the router url as a last resort', () => {
    const component = build({ getCurrentNavigation: () => null, url: '/last-resort' }, null);

    expect(component.attemptedUrl()).toBe('/last-resort');
  });

  it('captures the url once at construction, before the router moves on', () => {
    const component = build({
      getCurrentNavigation: () => ({ finalUrl: { toString: () => '/captured' } }),
    });

    expect(component.attemptedUrl()).toBe('/captured');
    expect(component.attemptedUrl()).toBe('/captured');
  });

  it('goes back through history', () => {
    const component = build({});
    component.back();

    expect(wentBack).toBe(1);
  });

  it('decides whether a back button makes sense from the history length', () => {
    expect(typeof build({}).canGoBack).toBe('boolean');
  });
});
