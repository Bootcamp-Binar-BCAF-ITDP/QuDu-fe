import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LayoutSearchService } from '../layout-search.service';
import { ICONS } from '../nav.config';
import { HeaderComponent } from './header.component';

describe('HeaderComponent', () => {
  let fixture: ComponentFixture<HeaderComponent>;
  let header: HeaderComponent;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [HeaderComponent] }).compileComponents();

    fixture = TestBed.createComponent(HeaderComponent);
    header = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('falls back to the product name when a route declares no title', () => {
    expect(header.title()).toBe('QuickDuit');
  });

  it('falls back to neutral wording when no user is known', () => {
    expect(header.userName()).toBe('Account');
    expect(header.userInitial()).toBe('A');
  });

  it('takes the title the layout resolved from the route', () => {
    fixture.componentRef.setInput('title', 'Applications History');
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Applications History');
  });

  it('accepts the signed-in user but renders neither name nor initial today', () => {
    fixture.componentRef.setInput('userName', 'Budi Santoso');
    fixture.componentRef.setInput('userInitial', 'B');
    fixture.detectChanges();

    expect(header.userName()).toBe('Budi Santoso');
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Budi Santoso');
  });

  it('shares the one search service, so the box and the page would agree', () => {
    expect(header.search).toBe(TestBed.inject(LayoutSearchService));
  });

  it('renders no search box, even though it injects the service that drives one', () => {
    const service = TestBed.inject(LayoutSearchService);
    service.configure('Search applications');
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('input')).toBeNull();
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain(
      'Search applications',
    );
  });

  it('renders the hamburger that opens the drawer on a phone', () => {
    const button = (fixture.nativeElement as HTMLElement).querySelector(
      'button[aria-label="Open navigation"]',
    );

    expect(button).not.toBeNull();
  });

  it('emits openMenu when the hamburger is pressed', () => {
    let opened = 0;
    header.openMenu.subscribe(() => (opened += 1));

    (
      (fixture.nativeElement as HTMLElement).querySelector(
        'button[aria-label="Open navigation"]',
      ) as HTMLButtonElement
    ).click();

    expect(opened).toBe(1);
  });

  it('exposes the shared icon set to its template', () => {
    expect(header.icons).toBe(ICONS);
  });

  it('asks the layout to open the drawer rather than opening it itself', () => {
    let opened = 0;
    header.openMenu.subscribe(() => (opened += 1));

    header.openMenu.emit();

    expect(opened).toBe(1);
  });
});
