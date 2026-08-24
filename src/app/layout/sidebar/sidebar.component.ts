import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';

import { FOOTER_ITEMS, ICONS, NAV_ITEMS, NavItem } from '../nav.config';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent {
  private readonly router = inject(Router);

  readonly navItems = NAV_ITEMS;
  readonly footerItems = FOOTER_ITEMS;
  readonly icons = ICONS;

  readonly url = signal(this.router.url);
  readonly openGroups = signal<Record<string, boolean>>({});

  constructor() {
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.url.set(this.router.url);
        this.openActiveGroups();
      });

    this.openActiveGroups();
  }

  isGroupActive(item: NavItem): boolean {
    return !!item.children?.some((child) => this.url().startsWith(child.route));
  }

  isOpen(item: NavItem): boolean {
    return this.openGroups()[item.label] ?? false;
  }

  toggleGroup(item: NavItem): void {
    this.openGroups.update((state) => ({ ...state, [item.label]: !state[item.label] }));
  }

  /** Expand any group containing the current route, without collapsing others. */
  private openActiveGroups(): void {
    const next = { ...this.openGroups() };
    let changed = false;

    for (const item of this.navItems) {
      if (item.children && this.isGroupActive(item) && !next[item.label]) {
        next[item.label] = true;
        changed = true;
      }
    }

    if (changed) this.openGroups.set(next);
  }
}
