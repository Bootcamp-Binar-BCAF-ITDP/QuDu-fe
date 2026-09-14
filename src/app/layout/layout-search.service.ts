import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LayoutSearchService {
  readonly query = signal('');
  readonly placeholder = signal('Search…');

  readonly enabled = signal(true);

  configure(placeholder: string): void {
    this.placeholder.set(placeholder);
    this.enabled.set(true);
  }

  disable(): void {
    this.enabled.set(false);
  }

  reset(): void {
    this.query.set('');
    this.placeholder.set('Search…');
    this.enabled.set(true);
  }
}
