import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SearchComponent } from './search.component';

describe('SearchComponent', () => {
  let fixture: ComponentFixture<SearchComponent>;
  let search: SearchComponent;

  let searched: string[];
  let cleared: number;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [SearchComponent] }).compileComponents();

    fixture = TestBed.createComponent(SearchComponent);
    search = fixture.componentInstance;

    searched = [];
    cleared = 0;
    search.search.subscribe((term) => searched.push(term));
    search.clear.subscribe(() => (cleared += 1));

    fixture.detectChanges();
  });

  it('starts with both the typed and the applied term empty', () => {
    expect(search.searchInput()).toBe('');
    expect(search.appliedSearch()).toBe('');
  });

  it('emits what the user typed', () => {
    search.searchInput.set('budi');
    search.submitSearch();

    expect(searched).toEqual(['budi']);
  });

  it('trims before emitting, so a stray space does not change the results', () => {
    search.searchInput.set('  budi  ');
    search.submitSearch();

    expect(searched).toEqual(['budi']);
  });

  it('records the applied term separately from what is being typed', () => {
    search.searchInput.set('  budi  ');
    search.submitSearch();

    expect(search.appliedSearch()).toBe('budi');
    expect(search.searchInput()).toBe('  budi  ');
  });

  it('emits an empty term for a blank search, which the page reads as no filter', () => {
    search.searchInput.set('   ');
    search.submitSearch();

    expect(searched).toEqual(['']);
  });

  it('ignores a submit while a request is already running', () => {
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();

    search.searchInput.set('budi');
    search.submitSearch();

    expect(searched).toEqual([]);
  });

  it('leaves the applied term untouched when it refuses a submit', () => {
    search.searchInput.set('first');
    search.submitSearch();

    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();

    search.searchInput.set('second');
    search.submitSearch();

    expect(search.appliedSearch()).toBe('first');
  });

  it('clears both terms and tells the page', () => {
    search.searchInput.set('budi');
    search.submitSearch();

    search.clearSearch();

    expect(search.searchInput()).toBe('');
    expect(search.appliedSearch()).toBe('');
    expect(cleared).toBe(1);
  });

  it('clears even while loading, so a stuck request can still be abandoned', () => {
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();

    search.searchInput.set('budi');
    search.clearSearch();

    expect(search.searchInput()).toBe('');
    expect(cleared).toBe(1);
  });

  it('emits clear rather than an empty search, so the page can tell them apart', () => {
    search.clearSearch();

    expect(cleared).toBe(1);
    expect(searched).toEqual([]);
  });

  it('gives each instance its own input id, so two boxes on a page do not collide', () => {
    const other = TestBed.createComponent(SearchComponent);
    other.detectChanges();

    expect(search.inputId()).not.toBe(other.componentInstance.inputId());
  });

  it('defaults its wording so a page can drop it in without configuring anything', () => {
    expect(search.placeholder()).toBe('Search...');
    expect(search.label()).toBe('Search');
    expect(search.buttonText()).toBe('Search');
    expect(search.loading()).toBe(false);
  });
});
