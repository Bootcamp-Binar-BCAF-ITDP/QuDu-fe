import { TestBed } from '@angular/core/testing';

import { LayoutSearchService } from './layout-search.service';

const DEFAULT_PLACEHOLDER = 'Search…';

describe('LayoutSearchService', () => {
  let service: LayoutSearchService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    service = TestBed.inject(LayoutSearchService);
  });

  it('starts empty, enabled, with the generic placeholder', () => {
    expect(service.query()).toBe('');
    expect(service.placeholder()).toBe(DEFAULT_PLACEHOLDER);
    expect(service.enabled()).toBe(true);
  });

  it('takes a placeholder from the page that configures it', () => {
    service.configure('Search applications');
    expect(service.placeholder()).toBe('Search applications');
  });

  it('re-enables the box when a page configures it after a page that disabled it', () => {
    service.disable();
    service.configure('Search users');

    expect(service.enabled()).toBe(true);
    expect(service.placeholder()).toBe('Search users');
  });

  it('hides the box for a page with nothing to search', () => {
    service.disable();
    expect(service.enabled()).toBe(false);
  });

  it('leaves the placeholder alone when disabling, since it is about to be hidden', () => {
    service.configure('Search applications');
    service.disable();

    expect(service.placeholder()).toBe('Search applications');
  });

  it('keeps whatever the user typed until someone resets it', () => {
    service.query.set('budi');
    service.configure('Search users');

    expect(service.query()).toBe('budi');
  });

  it('clears the term on reset, so one page search does not leak into the next', () => {
    service.query.set('budi');
    service.configure('Search users');
    service.disable();

    service.reset();

    expect(service.query()).toBe('');
    expect(service.placeholder()).toBe(DEFAULT_PLACEHOLDER);
    expect(service.enabled()).toBe(true);
  });

  it('is shared, so the header and the page see the same term', () => {
    const again = TestBed.inject(LayoutSearchService);

    service.query.set('shared');

    expect(again.query()).toBe('shared');
    expect(again).toBe(service);
  });
});
