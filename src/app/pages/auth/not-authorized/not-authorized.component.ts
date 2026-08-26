import { Location } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-not-authorized',
  standalone: true,
  templateUrl: './not-authorized.component.html',
})
export class NotAuthorizedComponent {
  private readonly location = inject(Location);
  private readonly router = inject(Router);

  readonly canGoBack = typeof history !== 'undefined' && history.length > 1;

  goToLogin() {
    this.router.navigate(['/login']);
  }

  roleLabel(role: string): string {
    if (!role) return '';
    const words = role.replace(/_/g, ' ').toLowerCase().trim();
    return words.charAt(0).toUpperCase() + words.slice(1);
  }

  back(): void {
    this.location.back();
  }
}
