import { Location } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  standalone: true,
  templateUrl: './not-found.component.html',
})
export class NotFoundComponent {
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  readonly attemptedUrl = signal(this.captureUrl());

  readonly canGoBack = typeof history !== 'undefined' && history.length > 1;

  private captureUrl(): string {
    const navigation = this.router.getCurrentNavigation();
    return (
      navigation?.finalUrl?.toString() ??
      navigation?.extractedUrl?.toString() ??
      this.location.path() ??
      this.router.url
    );
  }

  back(): void {
    this.location.back();
  }
}
