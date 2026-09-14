import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ActivatedRouteSnapshot, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

import { HeaderComponent } from './header/header.component';
import { LayoutSearchService } from './layout-search.service';
import { SidebarComponent } from './sidebar/sidebar.component';

const DEFAULT_TITLE = 'QuickDuit';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, HeaderComponent],
  templateUrl: './layout.component.html',
})
export class LayoutComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly search = inject(LayoutSearchService);

  readonly pageTitle = signal(DEFAULT_TITLE);

  /**
   * Only meaningful below lg, where the sidebar is an overlay drawer. From lg
   * up the sidebar is always on screen and this flag is ignored by the CSS.
   */
  readonly sidebarOpen = signal(false);

  constructor() {
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.pageTitle.set(this.resolveTitle());
        this.search.reset();

        // Without this, tapping a link on a phone navigates behind a drawer
        // that stays open over the page you just asked for.
        this.sidebarOpen.set(false);
      });

    this.pageTitle.set(this.resolveTitle());
  }

  openSidebar(): void {
    this.sidebarOpen.set(true);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  private resolveTitle(): string {
    let snapshot: ActivatedRouteSnapshot | null = this.router.routerState.snapshot.root;
    let title = DEFAULT_TITLE;

    while (snapshot) {
      title = snapshot.data['title'] ?? title;
      snapshot = snapshot.firstChild;
    }

    return title;
  }
}
